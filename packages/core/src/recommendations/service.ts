import type { DatabaseError } from "@animekaiser/db"
import {
  aiBudgetMonth,
  aiGeneration,
  aiPreference,
  aiUsageDaily,
  animeMetadata,
  Database,
  query,
  recommendationMessage,
  recommendationThread,
  room,
  roomParticipant,
  userLibraryEntry,
} from "@animekaiser/db"
import type {
  AnimeLibraryMetadata,
  RecommendationMessage,
  RecommendationThread,
  RoomActorShape,
} from "@animekaiser/domain"
import {
  AiModelId,
  RecapRequest,
  RecapResult,
  RecommendationCard,
  RecommendationOperationError,
} from "@animekaiser/domain"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import * as Cause from "effect/Cause"
import * as Clock from "effect/Clock"
import * as Context from "effect/Context"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { AnimeService } from "../anime"
import { notifyRoom } from "../rooms/events"
import {
  canAskAi,
  findParticipants,
  insertMessage,
  participantState,
  RoomService,
} from "../rooms/service"
import {
  assistantInstructions,
  catalogTools,
  groupTasteTool,
  type LibraryRow,
  type LibraryStatus,
  libraryTool,
  RunState,
  recapInstructions,
  researchInstructions,
  researchTool,
  submitRecapTool,
  titleOf,
  toMetadata,
} from "./agent"
import { notifyThread, ThreadEvents } from "./events"
import {
  type AgentProgress,
  type AgentRequest,
  type AiMessage,
  AiProvider,
} from "./provider"
import {
  agentCostCap,
  aiLimits,
  fitsBudget,
  normalizeUrl,
  recapBoundary,
  reservationUsd,
  supportedUrls,
  validRecapRequest,
} from "./rules"

type Actor = RoomActorShape
type ThreadRow = typeof recommendationThread.$inferSelect

const fail = (
  reason: RecommendationOperationError["reason"],
  message: string,
  resetsAt?: number
) => new RecommendationOperationError({ reason, message, resetsAt })

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10)
const monthOf = (date: Date) => date.toISOString().slice(0, 7)
const nextUtcMidnight = (now: number) => {
  const date = new Date(now)
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1
  )
}
const nextMonth = (now: number) => {
  const date = new Date(now)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
}

const MessageData = Schema.Struct({
  activity: Schema.optional(Schema.NullOr(Schema.String)),
  cards: Schema.optional(Schema.Array(RecommendationCard)),
  recap: Schema.optional(RecapResult),
  recapRequest: Schema.optional(RecapRequest),
  suggested: Schema.optional(Schema.Array(Schema.Number)),
})
type MessageData = typeof MessageData.Type
const decodeMessageData = Schema.decodeUnknownOption(MessageData)
const dataOf = (value: unknown): MessageData =>
  Option.getOrElse(decodeMessageData(value), () => ({}))

// Earlier recaps stay in the conversation with their spoiler boundary, so
// follow-up questions can use them without going past it.
const historyContent = (row: {
  readonly content: string
  readonly data: unknown
}) => {
  const recap = dataOf(row.data).recap
  if (!recap || recap.sections.length === 0) return row.content
  return [
    row.content,
    `[Recap shown. ${recap.contains}. ${recap.excludes}. Never reveal anything past this boundary.]`,
    ...recap.sections.map((section) => `${section.label}: ${section.summary}`),
  ].join("\n")
}

const toMessage = (
  row: typeof recommendationMessage.$inferSelect
): RecommendationMessage => {
  const data = dataOf(row.data)
  return {
    id: row.id,
    seq: row.seq,
    role: row.role,
    status: row.status,
    content: row.content,
    cards: data.cards ?? [],
    recap: data.recap ?? null,
    recapRequest: data.recapRequest ?? null,
    activity: row.status === "pending" ? (data.activity ?? null) : null,
    createdAt: row.createdAt.getTime(),
  }
}

type Owner =
  | { readonly kind: "account"; readonly userId: string }
  | {
      readonly kind: "guest"
      readonly participantId: string
      readonly roomId: string
    }

type Job = {
  generationId: string
  threadId: string | null
  roomId: string | null
  assistantMessageId: string | null
  amount: number
}

export class RecommendationService extends Context.Service<RecommendationService>()(
  "@animekaiser/core/RecommendationService",
  {
    make: Effect.gen(function* () {
      const database = yield* Database
      const provider = yield* AiProvider
      const animeService = yield* AnimeService
      const rooms = yield* RoomService
      const events = yield* ThreadEvents
      const running = new Map<string, Fiber.Fiber<void, never>>()

      const run = <A, R>(
        effect: Effect.Effect<
          A,
          RecommendationOperationError | DatabaseError,
          R
        >
      ) =>
        effect.pipe(
          Effect.tapErrorTag("DatabaseError", (error) =>
            Effect.logError("[AI] Database operation failed", error)
          ),
          Effect.catchTag("DatabaseError", () =>
            Effect.fail(fail("failed", "Something went wrong. Try again."))
          ),
          Effect.provideService(Database, database)
        )

      const transact = <A, R>(
        effect: Effect.Effect<
          A,
          RecommendationOperationError | DatabaseError,
          R
        >
      ) => run(database.transaction(effect))

      const postToRoom = (input: Parameters<typeof insertMessage>[0]) =>
        insertMessage(input).pipe(
          Effect.catchTag("RoomOperationError", (error) =>
            Effect.fail(fail("failed", error.message))
          )
        )

      const lockRoom = (roomId: string) =>
        query((db) =>
          db
            .select({ id: room.id })
            .from(room)
            .where(eq(room.id, roomId))
            .for("update")
        )

      const findRoom = (roomId: string) =>
        query((db) => db.select().from(room).where(eq(room.id, roomId))).pipe(
          Effect.map(([row]) => row ?? null)
        )

      const guestOwner = Effect.fnUntraced(function* (
        actor: Actor,
        roomId: string
      ) {
        const { guest } = yield* findParticipants(actor, roomId)
        const now = yield* Clock.currentTimeMillis
        if (!guest || participantState(guest, now) !== "admitted") return null
        return guest
      })

      const ownerOf = Effect.fnUntraced(function* (
        actor: Actor,
        thread: ThreadRow
      ) {
        if (thread.ownerUserId)
          return actor.user?.id === thread.ownerUserId
            ? ({ kind: "account", userId: thread.ownerUserId } as Owner)
            : null
        if (thread.guestParticipantId && thread.roomId) {
          const guest = yield* guestOwner(actor, thread.roomId)
          return guest?.id === thread.guestParticipantId
            ? ({
                kind: "guest",
                participantId: guest.id,
                roomId: thread.roomId,
              } as Owner)
            : null
        }
        return null
      })

      const loadThread = Effect.fnUntraced(function* (thread: ThreadRow) {
        const rows = yield* query((db) =>
          db
            .select()
            .from(recommendationMessage)
            .where(eq(recommendationMessage.threadId, thread.id))
            .orderBy(asc(recommendationMessage.seq))
        )
        const [busy] = yield* query((db) =>
          db
            .select({ id: aiGeneration.id })
            .from(aiGeneration)
            .where(
              and(
                eq(aiGeneration.threadId, thread.id),
                eq(aiGeneration.status, "running")
              )
            )
        )
        const context = (thread.context ?? {}) as {
          seed?: AnimeLibraryMetadata
        }
        const loaded: RecommendationThread = {
          id: thread.id,
          title: thread.title,
          scope: thread.ownerUserId ? "personal" : "guest",
          updatedAt: thread.updatedAt.getTime(),
          seed: context.seed ?? null,
          messages: rows.map(toMessage),
          busy: busy !== undefined,
        }
        return loaded
      })

      const requireThread = Effect.fnUntraced(function* (
        actor: Actor,
        threadId: string,
        lock = false
      ) {
        const [thread] = yield* query(async (db) => {
          const select = db
            .select()
            .from(recommendationThread)
            .where(eq(recommendationThread.id, threadId))
          return lock ? await select.for("update") : await select
        })
        if (!thread)
          return yield* fail("not_found", "This conversation was not found.")
        const owner = yield* ownerOf(actor, thread)
        if (!owner)
          return yield* fail("not_found", "This conversation was not found.")
        return { thread, owner }
      })

      const availability = Effect.fn("RecommendationService.availability")(
        function* (actor: Actor, roomId: string | undefined) {
          const notConfigured = {
            available: false,
            reason: "not_configured" as const,
            remainingToday: 0,
            resetsAt: null,
          }
          if (!provider.run) return notConfigured
          const now = yield* Clock.currentTimeMillis
          return yield* Effect.gen(function* () {
            const key = actor.user
              ? `user:${actor.user.id}`
              : roomId
                ? `guest:${(yield* guestOwner(actor, roomId))?.id ?? "none"}`
                : "none"
            const limit = actor.user ? aiLimits.userDaily : aiLimits.guestDaily
            const [usage] = yield* query((db) =>
              db
                .select({ count: aiUsageDaily.count })
                .from(aiUsageDaily)
                .where(
                  and(
                    eq(aiUsageDaily.key, key),
                    eq(aiUsageDaily.day, dayOf(now))
                  )
                )
            )
            const [month] = yield* query((db) =>
              db
                .select()
                .from(aiBudgetMonth)
                .where(eq(aiBudgetMonth.month, monthOf(new Date(now))))
            )
            const remaining = Math.max(0, limit - (usage?.count ?? 0))
            if (
              month &&
              !fitsBudget(
                {
                  reservedUsd: Number(month.reservedUsd),
                  spentUsd: Number(month.spentUsd),
                },
                reservationUsd.recommend
              )
            )
              return {
                available: false,
                reason: "budget" as const,
                remainingToday: remaining,
                resetsAt: nextMonth(now),
              }
            return remaining === 0
              ? {
                  available: false,
                  reason: "daily_limit" as const,
                  remainingToday: 0,
                  resetsAt: nextUtcMidnight(now),
                }
              : {
                  available: true,
                  reason: "ok" as const,
                  remainingToday: remaining,
                  resetsAt: null,
                }
          }).pipe(
            run,
            Effect.orElseSucceed(() => notConfigured)
          )
        }
      )

      const list = Effect.fn("RecommendationService.list")(function* (
        userId: string
      ) {
        const rows = yield* query((db) =>
          db
            .select()
            .from(recommendationThread)
            .where(eq(recommendationThread.ownerUserId, userId))
            .orderBy(desc(recommendationThread.updatedAt))
            .limit(100)
        )
        return rows.map((row) => ({
          id: row.id,
          title: row.title,
          scope: "personal" as const,
          updatedAt: row.updatedAt.getTime(),
        }))
      }, run)

      const createOwner = Effect.fnUntraced(function* (
        actor: Actor,
        roomId: string | undefined
      ) {
        if (actor.user) return { ownerUserId: actor.user.id }
        if (!roomId)
          return yield* fail("forbidden", "Sign in to use AI recommendations.")
        const guest = yield* guestOwner(actor, roomId)
        const roomRow = yield* findRoom(roomId)
        if (!guest || !roomRow)
          return yield* fail("forbidden", "Join the room to use its catch-up.")
        if (!canAskAi(roomRow.aiAccess, false, roomRow.status))
          return yield* fail(
            "forbidden",
            "The host hasn't allowed guests to ask AI here."
          )
        return { guestParticipantId: guest.id, roomId }
      })

      const create = Effect.fn("RecommendationService.create")(function* (
        actor: Actor,
        input: { threadId: string; seedMalId?: number; roomId?: string }
      ) {
        const seed = input.seedMalId
          ? yield* animeService.getDetail(input.seedMalId).pipe(
              Effect.map(toMetadata),
              Effect.mapError(() =>
                fail("invalid", "That anime couldn't be loaded.")
              )
            )
          : null
        return yield* transact(
          Effect.gen(function* () {
            const [existing] = yield* query((db) =>
              db
                .select()
                .from(recommendationThread)
                .where(eq(recommendationThread.id, input.threadId))
            )
            if (existing) {
              if (!(yield* ownerOf(actor, existing)))
                return yield* fail(
                  "not_found",
                  "This conversation was not found."
                )
              return yield* loadThread(existing)
            }
            const owner = yield* createOwner(actor, input.roomId)
            const [thread] = yield* query((db) =>
              db
                .insert(recommendationThread)
                .values({
                  id: input.threadId,
                  ...owner,
                  title: seed ? `Like ${titleOf(seed)}` : "New conversation",
                  context: seed ? { seed } : null,
                })
                .returning()
            )
            if (!thread)
              return yield* fail("failed", "Unable to start a conversation.")
            return yield* loadThread(thread)
          })
        )
      })

      const get = Effect.fn("RecommendationService.get")(function* (
        actor: Actor,
        threadId: string
      ) {
        const { thread } = yield* requireThread(actor, threadId)
        return yield* loadThread(thread)
      }, run)

      // Pushes the thread whenever it changes, so a running answer streams
      // its progress without the client polling.
      const watch = (actor: Actor, threadId: string) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const signals = yield* events.subscribe(threadId)
            yield* run(requireThread(actor, threadId))
            return Stream.concat(
              Stream.succeed(undefined),
              Stream.merge(signals, Stream.tick("15 seconds")).pipe(
                Stream.groupedWithin(64, "100 millis")
              )
            ).pipe(
              Stream.mapEffect(() => get(actor, threadId)),
              Stream.changesWith(
                (left, right) => JSON.stringify(left) === JSON.stringify(right)
              )
            )
          })
        )

      const rename = Effect.fn("RecommendationService.rename")(function* (
        userId: string,
        threadId: string,
        title: string
      ) {
        yield* query((db) =>
          db
            .update(recommendationThread)
            .set({ title: title.trim() })
            .where(
              and(
                eq(recommendationThread.id, threadId),
                eq(recommendationThread.ownerUserId, userId)
              )
            )
        )
      }, run)

      const remove = Effect.fn("RecommendationService.remove")(function* (
        userId: string,
        threadId: string
      ) {
        const owned = and(
          eq(recommendationThread.id, threadId),
          eq(recommendationThread.ownerUserId, userId)
        )
        const [thread] = yield* run(
          query((db) =>
            db
              .select({ id: recommendationThread.id })
              .from(recommendationThread)
              .where(owned)
          )
        )
        if (!thread) return
        yield* stopThread(threadId)
        yield* run(query((db) => db.delete(recommendationThread).where(owned)))
      })

      const getPreferences = Effect.fn("RecommendationService.getPreferences")(
        function* (userId: string) {
          const [row] = yield* query((db) =>
            db
              .select()
              .from(aiPreference)
              .where(eq(aiPreference.userId, userId))
          )
          return row?.notes ?? []
        },
        run
      )

      const savePreferences = Effect.fn(
        "RecommendationService.savePreferences"
      )(function* (userId: string, notes: ReadonlyArray<string>) {
        const clean = notes.map((note) => note.trim()).filter(Boolean)
        const updatedAt = new Date(yield* Clock.currentTimeMillis)
        yield* query((db) =>
          db
            .insert(aiPreference)
            .values({ userId, notes: clean })
            .onConflictDoUpdate({
              target: aiPreference.userId,
              set: { notes: clean, updatedAt },
            })
        )
      }, run)

      const bumpUsage = Effect.fnUntraced(function* (
        key: string,
        day: string,
        limit: number,
        reason: "daily_limit" | "room_limit",
        now: number
      ) {
        const [row] = yield* query((db) =>
          db
            .insert(aiUsageDaily)
            .values({ key, day, count: 1 })
            .onConflictDoUpdate({
              target: [aiUsageDaily.key, aiUsageDaily.day],
              set: { count: sql`${aiUsageDaily.count} + 1` },
            })
            .returning({ count: aiUsageDaily.count })
        )
        if ((row?.count ?? 0) > limit)
          return yield* fail(
            reason,
            reason === "daily_limit"
              ? "You've reached today's AI limit."
              : "This room has reached today's AI limit.",
            nextUtcMidnight(now)
          )
      })

      // Counts and budget are reserved in the same transaction that records
      // the generation, so concurrent or retried requests cannot overspend.
      const reserve = Effect.fnUntraced(function* (input: {
        actorKey: string
        actorLimit: number
        roomId: string | null
        amount: number
        at: Date
      }) {
        const now = input.at.getTime()
        const day = dayOf(now)
        yield* bumpUsage(
          input.actorKey,
          day,
          input.actorLimit,
          "daily_limit",
          now
        )
        if (input.roomId)
          yield* bumpUsage(
            `room:${input.roomId}`,
            day,
            aiLimits.roomDaily,
            "room_limit",
            now
          )
        // The generation stores the same instant as `createdAt`, so settling
        // later always finds the month this reservation was made in.
        const month = monthOf(input.at)
        yield* query((db) =>
          db.insert(aiBudgetMonth).values({ month }).onConflictDoNothing()
        )
        const [budget] = yield* query((db) =>
          db
            .select()
            .from(aiBudgetMonth)
            .where(eq(aiBudgetMonth.month, month))
            .for("update")
        )
        if (
          !budget ||
          !fitsBudget(
            {
              reservedUsd: Number(budget.reservedUsd),
              spentUsd: Number(budget.spentUsd),
            },
            input.amount
          )
        )
          return yield* fail(
            "budget",
            "AI is paused for the rest of the month.",
            nextMonth(now)
          )
        yield* query((db) =>
          db
            .update(aiBudgetMonth)
            .set({
              reservedUsd: sql`${aiBudgetMonth.reservedUsd} + ${input.amount}`,
            })
            .where(eq(aiBudgetMonth.month, month))
        )
      })

      const settle = (amount: number, cost: number | null, month: string) =>
        query((db) =>
          db
            .update(aiBudgetMonth)
            .set({
              reservedUsd: sql`greatest(0, ${aiBudgetMonth.reservedUsd} - ${amount})`,
              spentUsd: sql`${aiBudgetMonth.spentUsd} + ${cost ?? amount}`,
            })
            .where(eq(aiBudgetMonth.month, month))
        )

      type Outcome = {
        content: string
        data: MessageData
        cost: number | null
        usage: Array<unknown>
      }

      const agent = (request: AgentRequest) =>
        provider.run
          ? provider.run(request).pipe(
              Effect.tapError((error) =>
                Effect.logWarning("[AI] Agent run failed", error.message)
              ),
              Effect.mapError(() =>
                fail("failed", "The AI service didn't respond. Try again.")
              )
            )
          : Effect.fail(fail("not_configured", "AI isn't configured."))

      const progressTo = (messageId: string | null) =>
        messageId
          ? (progress: AgentProgress) =>
              run(
                Effect.gen(function* () {
                  const updated = yield* query((db) =>
                    db
                      .update(recommendationMessage)
                      .set({
                        content: progress.text,
                        data: { activity: progress.activity },
                      })
                      .where(
                        and(
                          eq(recommendationMessage.id, messageId),
                          eq(recommendationMessage.status, "pending")
                        )
                      )
                      .returning({ threadId: recommendationMessage.threadId })
                  )
                  for (const row of updated) yield* notifyThread(row.threadId)
                })
              ).pipe(Effect.ignore)
          : undefined

      const readLibrary = (userId: string) => (status?: LibraryStatus) =>
        run(
          query((db) =>
            db
              .select({ entry: userLibraryEntry, anime: animeMetadata })
              .from(userLibraryEntry)
              .innerJoin(
                animeMetadata,
                eq(animeMetadata.malId, userLibraryEntry.malId)
              )
              .where(
                and(
                  eq(userLibraryEntry.userId, userId),
                  status ? eq(userLibraryEntry.status, status) : undefined
                )
              )
              .orderBy(desc(userLibraryEntry.updatedAt))
          )
        ).pipe(
          Effect.map((rows) =>
            rows.map(
              (row): LibraryRow => ({
                malId: row.entry.malId,
                title: row.anime.titleEnglish ?? row.anime.titleRomaji,
                status: row.entry.status as LibraryStatus,
                score: row.entry.score,
                progress: row.entry.progress,
              })
            )
          ),
          Effect.orElseSucceed((): ReadonlyArray<LibraryRow> => [])
        )

      const libraryStatusOf = (userId: string) =>
        run(
          query((db) =>
            db
              .select({
                malId: userLibraryEntry.malId,
                status: userLibraryEntry.status,
              })
              .from(userLibraryEntry)
              .where(eq(userLibraryEntry.userId, userId))
          )
        ).pipe(
          Effect.map(
            (rows) =>
              new Map(rows.map((row) => [row.malId, row.status as string]))
          ),
          Effect.orElseSucceed(() => new Map<number, string>())
        )

      // Only consenting signed-in members contribute, aggregated without names.
      const roomTaste = Effect.fnUntraced(function* (roomId: string) {
        const members = yield* query((db) =>
          db
            .select({ userId: roomParticipant.userId })
            .from(roomParticipant)
            .where(
              and(
                eq(roomParticipant.roomId, roomId),
                eq(roomParticipant.state, "admitted"),
                eq(roomParticipant.shareTaste, true)
              )
            )
        )
        const ids = members.flatMap((member) =>
          member.userId ? [member.userId] : []
        )
        if (ids.length === 0) return ""
        const rows = yield* query((db) =>
          db
            .select({ entry: userLibraryEntry, anime: animeMetadata })
            .from(userLibraryEntry)
            .innerJoin(
              animeMetadata,
              eq(animeMetadata.malId, userLibraryEntry.malId)
            )
            .where(inArray(userLibraryEntry.userId, ids))
        )
        const genres = new Map<string, number>()
        for (const row of rows)
          if ((row.entry.score ?? 0) >= 70 || row.entry.status === "completed")
            for (const genre of row.anime.genres)
              genres.set(genre, (genres.get(genre) ?? 0) + 1)
        const topGenres = [...genres.entries()]
          .sort((left, right) => right[1] - left[1])
          .slice(0, 6)
          .map(([genre]) => genre)
        const favorites = [
          ...new Set(
            rows
              .filter((row) => (row.entry.score ?? 0) >= 80)
              .map((row) => row.anime.titleEnglish ?? row.anime.titleRomaji)
          ),
        ].slice(0, 10)
        const completed = [
          ...new Set(
            rows
              .filter((row) => row.entry.status === "completed")
              .map((row) => row.anime.titleEnglish ?? row.anime.titleRomaji)
          ),
        ].slice(0, 30)
        return [
          `${ids.length} member(s) shared their taste.`,
          topGenres.length ? `Common genres: ${topGenres.join(", ")}` : null,
          favorites.length
            ? `Titles the group rated highly: ${favorites.join("; ")}`
            : null,
          completed.length
            ? `Already completed by someone here: ${completed.join("; ")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      })

      const assist = (input: {
        scope: "personal" | "room"
        conversation: ReadonlyArray<AiMessage>
        userId: string | null
        groupTaste: string
        seed: AnimeLibraryMetadata | null
        earlier: ReadonlyArray<number>
        messageId: string | null
      }) =>
        Effect.gen(function* () {
          const state = new RunState()
          const userId = input.userId
          const preferences = userId
            ? yield* run(
                query((db) =>
                  db
                    .select()
                    .from(aiPreference)
                    .where(eq(aiPreference.userId, userId))
                )
              ).pipe(
                Effect.map(([row]) => row?.notes ?? []),
                Effect.orElseSucceed((): Array<string> => [])
              )
            : []
          const library =
            input.scope === "personal" && input.userId
              ? yield* libraryStatusOf(input.userId)
              : new Map<number, string>()
          const tools = [
            ...catalogTools({ anime: animeService, state, library }),
            input.scope === "personal" && input.userId
              ? libraryTool(readLibrary(input.userId))
              : groupTasteTool(input.groupTaste),
            researchTool({
              anime: animeService,
              state,
              research: (question) =>
                agent({
                  instructions: researchInstructions,
                  messages: [{ role: "user", content: question }],
                  tools: [],
                  web: true,
                  maxSearches: 2,
                  maxSteps: 2,
                  maxCostUsd: agentCostCap.research,
                  maxOutputTokens: 800,
                  reasoning: "low",
                }),
            }),
          ]
          const result = yield* agent({
            instructions: assistantInstructions({
              scope: input.scope,
              seed: input.seed,
              preferences,
              earlier: input.earlier,
            }),
            messages: input.conversation,
            tools,
            web: false,
            maxSearches: 0,
            maxSteps: 8,
            maxCostUsd: agentCostCap.recommend,
            maxOutputTokens: 1500,
            reasoning: "medium",
            onProgress: progressTo(input.messageId),
          })
          return {
            content:
              result.text.trim() ||
              (state.cards.length > 0
                ? "Here are a few picks."
                : "I couldn't find a good fit. Try relaxing a constraint."),
            data: {
              cards: state.cards,
              suggested: state.cards.map((card) => card.anime.malId),
            },
            cost:
              result.costUsd === null || state.researchCostUsd === null
                ? null
                : result.costUsd + state.researchCostUsd,
            usage: [result.usage],
          } satisfies Outcome
        })

      const recap = (request: RecapRequest, messageId: string | null) =>
        Effect.gen(function* () {
          const details = yield* Effect.forEach(
            request.entries,
            (entry) =>
              animeService
                .getDetail(entry.malId)
                .pipe(
                  Effect.mapError(() =>
                    fail(
                      "invalid",
                      "One of the selected entries couldn't be loaded."
                    )
                  )
                ),
            { concurrency: 3 }
          )
          for (const [index, entry] of request.entries.entries()) {
            const episodes = details[index]?.episodes
            if (
              episodes !== null &&
              episodes !== undefined &&
              entry.toEpisode > episodes
            )
              return yield* fail(
                "invalid",
                "That episode range is outside the entry."
              )
          }
          const state = new RunState()
          const result = yield* agent({
            instructions: recapInstructions(
              request,
              details.map((detail) => ({
                title: detail.title.romaji,
                altTitle: detail.title.english,
              }))
            ),
            messages: [{ role: "user", content: "Write the catch-up recap." }],
            tools: [submitRecapTool(state)],
            web: true,
            maxSearches: 6,
            maxSteps: 10,
            maxCostUsd: agentCostCap.recap,
            maxOutputTokens: 6000,
            reasoning: "low",
            finishWith: "submit_recap",
            onProgress: progressTo(messageId),
          })
          const boundary = recapBoundary(request)
          const draft = state.recap
          const evidence = result.evidence.map((entry) => entry.url)
          const sourceIds = new Map<string, string>()
          const sources: Array<RecapResult["sources"][number]> = []
          const sourceFor = (url: string, label: string) => {
            const key = normalizeUrl(url) ?? url
            const existing = sourceIds.get(key)
            if (existing) return existing
            const id = `s${sources.length + 1}`
            sourceIds.set(key, id)
            sources.push({
              id,
              url,
              domain: new URL(url).hostname.replace(/^www\./, ""),
              label,
              title:
                result.evidence.find((entry) => entry.url === url)?.title ??
                null,
            })
            return id
          }
          const ranges = new Map(
            request.entries.map((entry) => [entry.malId, entry])
          )
          const gaps = [...(draft?.gaps ?? [])]
          const sections = (draft?.sections ?? []).flatMap((section) => {
            const range = ranges.get(section.malId)
            const inRange =
              range !== undefined &&
              section.fromEpisode >= range.fromEpisode &&
              section.toEpisode <= range.toEpisode &&
              section.fromEpisode <= section.toEpisode
            const supported = supportedUrls(section.sourceUrls, evidence)
            if (!inRange) return []
            if (supported.length === 0) {
              gaps.push({
                label: section.label,
                reason: "No retrieved source supported this part.",
              })
              return []
            }
            return [
              {
                label: section.label,
                malId: section.malId,
                fromEpisode: section.fromEpisode,
                toEpisode: section.toEpisode,
                summary: section.summary,
                interpretation: section.interpretation,
                sourceIds: supported.map((url) =>
                  sourceFor(url, section.label)
                ),
              },
            ]
          })
          for (const [index, entry] of request.entries.entries()) {
            const covered = new Set(
              sections
                .filter((section) => section.malId === entry.malId)
                .flatMap((section) =>
                  Array.from(
                    { length: section.toEpisode - section.fromEpisode + 1 },
                    (_, offset) => section.fromEpisode + offset
                  )
                )
            )
            const title = details[index] ? titleOf(details[index]) : entry.title
            let start: number | null = null
            for (
              let episode = entry.fromEpisode;
              episode <= entry.toEpisode + 1;
              episode++
            ) {
              const missing =
                episode <= entry.toEpisode && !covered.has(episode)
              if (missing && start === null) start = episode
              if (!missing && start !== null) {
                const end = episode - 1
                gaps.push({
                  label: `${title} ${start === end ? `episode ${start}` : `episodes ${start}–${end}`}`,
                  reason: "No verified source covered this part.",
                })
                start = null
              }
            }
          }
          return {
            content:
              sections.length === 0
                ? "I couldn't find enough reliable sources for this range, so I won't guess. Try a narrower range or ask again later."
                : gaps.length > 0
                  ? `Here's your catch-up. ${gaps.length} part(s) had too little evidence and are listed as gaps.`
                  : "Here's your catch-up.",
            data: {
              recap: {
                request,
                ...boundary,
                sections,
                gaps,
                sources,
                limitation:
                  sections.length === 0
                    ? "No verified evidence was found."
                    : "Summaries are written from public sources and may miss details. Source pages can contain later spoilers.",
                retrievedAt: yield* Clock.currentTimeMillis,
              },
            },
            cost: result.costUsd,
            usage: [result.usage],
          } satisfies Outcome
        })

      type Result =
        | { status: "completed"; outcome: Outcome }
        | {
            status: "failed" | "stopped" | "interrupted"
            error: string
            cost?: number | null
          }

      // `allowed` is rechecked in the publishing transaction while holding
      // the room row, which every room permission change also updates, so an
      // answer finishing just after access was revoked is never shown.
      type Publication = {
        roomId: string | null
        allowed: Effect.Effect<boolean, DatabaseError, Database>
        publish?: (
          outcome: Outcome
        ) => Effect.Effect<
          void,
          RecommendationOperationError | DatabaseError,
          Database
        >
      }

      const revokedMessage = "Stopped because AI access changed."

      const finish = Effect.fnUntraced(function* (
        job: Job,
        result: Result,
        publication?: Publication
      ) {
        if (publication?.roomId) yield* lockRoom(publication.roomId)
        const final: Result =
          result.status === "completed" &&
          publication &&
          !(yield* publication.allowed)
            ? {
                status: "stopped",
                error: revokedMessage,
                cost: result.outcome.cost,
              }
            : result
        const cost =
          final.status === "completed"
            ? final.outcome.cost
            : (final.cost ?? null)
        const finishedAt = new Date(yield* Clock.currentTimeMillis)
        const [generation] = yield* query((db) =>
          db
            .update(aiGeneration)
            .set({
              status: final.status,
              actualUsd: cost === null ? null : String(cost),
              usage: final.status === "completed" ? final.outcome.usage : null,
              error: final.status === "completed" ? null : final.error,
              finishedAt,
            })
            .where(
              and(
                eq(aiGeneration.id, job.generationId),
                eq(aiGeneration.status, "running")
              )
            )
            .returning()
        )
        if (!generation) return
        if (final.status === "completed" && publication?.publish)
          yield* publication.publish(final.outcome)
        const { assistantMessageId, threadId } = job
        if (assistantMessageId)
          yield* query((db) =>
            db
              .update(recommendationMessage)
              .set(
                final.status === "completed"
                  ? {
                      status: "complete",
                      content: final.outcome.content,
                      data: final.outcome.data,
                    }
                  : {
                      status:
                        final.status === "failed" ? "failed" : final.status,
                      content: final.error,
                    }
              )
              .where(eq(recommendationMessage.id, assistantMessageId))
          )
        if (threadId) {
          yield* query((db) =>
            db
              .update(recommendationThread)
              .set({ updatedAt: finishedAt })
              .where(eq(recommendationThread.id, threadId))
          )
          yield* notifyThread(threadId)
        }
        yield* settle(job.amount, cost, monthOf(generation.createdAt))
        if (job.roomId) yield* notifyRoom(job.roomId)
      }, transact)

      const resultOf = (
        exit: Exit.Exit<
          { outcome: Outcome } | { revoked: "revoked" },
          RecommendationOperationError
        >
      ): Result =>
        Exit.match(exit, {
          onSuccess: (value): Result =>
            "revoked" in value
              ? { status: "stopped", error: revokedMessage }
              : { status: "completed", outcome: value.outcome },
          onFailure: (cause): Result =>
            Cause.hasInterruptsOnly(cause)
              ? { status: "stopped", error: "Stopped." }
              : {
                  status: "failed",
                  error:
                    Option.getOrNull(Cause.findErrorOption(cause))?.message ??
                    "Something went wrong. Try again.",
                },
        })

      const launch = (
        job: Job,
        work: Effect.Effect<Outcome, RecommendationOperationError>,
        publication: Publication
      ) =>
        Effect.gen(function* () {
          const stillAllowed = run(publication.allowed).pipe(
            Effect.orElseSucceed(() => false)
          )
          // Losing permission mid-generation (room AI switched off, member
          // removed) stops the work instead of publishing late results.
          const permissionLoop = Effect.gen(function* () {
            while (true) {
              yield* Effect.sleep("2 seconds")
              if (!(yield* stillAllowed)) return "revoked" as const
            }
          })
          const guarded = Effect.raceFirst(
            work.pipe(Effect.map((outcome) => ({ outcome }))),
            permissionLoop.pipe(Effect.map((revoked) => ({ revoked })))
          ).pipe(
            Effect.timeoutOrElse({
              duration: Duration.seconds(150),
              orElse: () =>
                Effect.fail(fail("failed", "The AI took too long to answer.")),
            })
          )
          // Settlement runs as an exit finalizer so stopping (interruption)
          // still releases the reservation and frees the thread or room.
          // Callers launch from an uninterruptible region, which the forked
          // work would otherwise inherit, leaving it impossible to stop.
          const fiber = yield* Effect.interruptible(guarded).pipe(
            Effect.onExit((exit) =>
              (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)
                ? Effect.logWarning("[AI] Generation failed", exit.cause)
                : Effect.void
              ).pipe(
                Effect.andThen(finish(job, resultOf(exit), publication)),
                Effect.catchCause((cause) =>
                  Effect.logWarning("[AI] Publishing failed", cause).pipe(
                    Effect.andThen(
                      finish(job, {
                        status: "failed",
                        error: "Something went wrong. Try again.",
                      })
                    )
                  )
                ),
                Effect.ignore
              )
            ),
            Effect.ignore,
            Effect.ensuring(
              Effect.sync(() => running.delete(job.generationId))
            ),
            Effect.forkDetach
          )
          running.set(job.generationId, fiber)
        })

      const stopGeneration = (generationId: string, amountFallback: number) =>
        Effect.gen(function* () {
          const fiber = running.get(generationId)
          if (fiber) {
            yield* Fiber.interrupt(fiber)
            return
          }
          yield* finish(
            {
              generationId,
              threadId: null,
              roomId: null,
              assistantMessageId: null,
              amount: amountFallback,
            },
            { status: "stopped", error: "Stopped." }
          )
        })

      const stopThread = (threadId: string) =>
        run(
          query((db) =>
            db
              .select()
              .from(aiGeneration)
              .where(
                and(
                  eq(aiGeneration.threadId, threadId),
                  eq(aiGeneration.status, "running")
                )
              )
          )
        ).pipe(
          Effect.flatMap((rows) =>
            Effect.forEach(rows, (row) =>
              stopGeneration(row.id, Number(row.reservedUsd)).pipe(
                Effect.ignore
              )
            )
          ),
          Effect.asVoid
        )

      const prepareSend = Effect.fnUntraced(function* (
        actor: Actor,
        input: {
          threadId: string
          requestId: string
          content: string
          recap?: RecapRequest
        },
        kind: "recap" | "recommend",
        amount: number
      ) {
        // Locks go room, thread, budget everywhere AI and rooms meet.
        const [guestThread] = yield* query((db) =>
          db
            .select({ roomId: recommendationThread.roomId })
            .from(recommendationThread)
            .where(eq(recommendationThread.id, input.threadId))
        )
        if (guestThread?.roomId) yield* lockRoom(guestThread.roomId)
        const { thread, owner } = yield* requireThread(
          actor,
          input.threadId,
          true
        )
        const [duplicate] = yield* query((db) =>
          db
            .select()
            .from(recommendationMessage)
            .where(
              and(
                eq(recommendationMessage.threadId, thread.id),
                eq(recommendationMessage.requestId, input.requestId)
              )
            )
        )
        if (duplicate) return { thread, owner, job: null }
        if (owner.kind === "guest") {
          if (!input.recap)
            return yield* fail(
              "forbidden",
              "Guests can use AI for catch-up recaps."
            )
          const roomRow = yield* findRoom(owner.roomId)
          if (!roomRow || !canAskAi(roomRow.aiAccess, false, roomRow.status))
            return yield* fail(
              "forbidden",
              "The host hasn't allowed guests to ask AI here."
            )
        }
        const [busy] = yield* query((db) =>
          db
            .select({ id: aiGeneration.id })
            .from(aiGeneration)
            .where(
              and(
                eq(aiGeneration.threadId, thread.id),
                eq(aiGeneration.status, "running")
              )
            )
        )
        if (busy)
          return yield* fail(
            "busy",
            "Wait for the current answer or stop it first."
          )
        const reservedAt = new Date(yield* Clock.currentTimeMillis)
        const actorKey =
          owner.kind === "account"
            ? `user:${owner.userId}`
            : `guest:${owner.participantId}`
        yield* reserve({
          actorKey,
          actorLimit:
            owner.kind === "account" ? aiLimits.userDaily : aiLimits.guestDaily,
          roomId: owner.kind === "guest" ? owner.roomId : null,
          amount,
          at: reservedAt,
        })
        const [generation] = yield* query((db) =>
          db
            .insert(aiGeneration)
            .values({
              requestId: input.requestId,
              actorKey,
              roomId: owner.kind === "guest" ? owner.roomId : null,
              threadId: thread.id,
              kind,
              status: "running",
              model: provider.model,
              reservedUsd: String(amount),
              createdAt: reservedAt,
            })
            .returning()
        )
        if (!generation)
          return yield* fail("failed", "Unable to start the request.")
        const [last] = yield* query((db) =>
          db
            .select({ seq: recommendationMessage.seq })
            .from(recommendationMessage)
            .where(eq(recommendationMessage.threadId, thread.id))
            .orderBy(desc(recommendationMessage.seq))
            .limit(1)
        )
        const seq = (last?.seq ?? 0) + 1
        yield* query((db) =>
          db.insert(recommendationMessage).values({
            threadId: thread.id,
            seq,
            role: "user",
            status: "complete",
            content: input.content,
            requestId: input.requestId,
            data: input.recap ? { recapRequest: input.recap } : null,
          })
        )
        const [assistant] = yield* query((db) =>
          db
            .insert(recommendationMessage)
            .values({
              threadId: thread.id,
              seq: seq + 1,
              role: "assistant",
              status: "pending",
              content: "",
              generationId: generation.id,
            })
            .returning()
        )
        if (thread.title === "New conversation")
          yield* query((db) =>
            db
              .update(recommendationThread)
              .set({ title: input.content.slice(0, 60) })
              .where(eq(recommendationThread.id, thread.id))
          )
        const history = yield* query((db) =>
          db
            .select()
            .from(recommendationMessage)
            .where(eq(recommendationMessage.threadId, thread.id))
            .orderBy(desc(recommendationMessage.seq))
            .limit(10)
        )
        const [lastRecap] = yield* query((db) =>
          db
            .select()
            .from(recommendationMessage)
            .where(
              and(
                eq(recommendationMessage.threadId, thread.id),
                eq(recommendationMessage.status, "complete"),
                sql`${recommendationMessage.data} -> 'recap' is not null`
              )
            )
            .orderBy(desc(recommendationMessage.seq))
            .limit(1)
        )
        yield* notifyThread(thread.id)
        return {
          thread,
          owner,
          history: history.reverse(),
          lastRecap: lastRecap ?? null,
          job: {
            generationId: generation.id,
            threadId: thread.id,
            roomId: null,
            assistantMessageId: assistant?.id ?? null,
            amount,
          } satisfies Job,
        }
      }, transact)

      // A guest who converts mid-run now owns the thread as an account, which
      // keeps the answer.
      const guestStillAllowed = Effect.fnUntraced(function* (
        threadId: string,
        owner: Extract<Owner, { kind: "guest" }>
      ) {
        const [current] = yield* query((db) =>
          db
            .select()
            .from(recommendationThread)
            .where(eq(recommendationThread.id, threadId))
        )
        if (!current) return false
        if (current.ownerUserId) return true
        const roomRow = yield* findRoom(owner.roomId)
        const [participant] = yield* query((db) =>
          db
            .select()
            .from(roomParticipant)
            .where(eq(roomParticipant.id, owner.participantId))
        )
        const now = yield* Clock.currentTimeMillis
        return Boolean(
          roomRow &&
            participant &&
            current.guestParticipantId === participant.id &&
            participantState(participant, now) === "admitted" &&
            canAskAi(roomRow.aiAccess, false, roomRow.status)
        )
      })

      const send = Effect.fn("RecommendationService.send")(function* (
        actor: Actor,
        input: {
          threadId: string
          requestId: string
          content: string
          recap?: RecapRequest
        }
      ) {
        if (!provider.run)
          return yield* fail(
            "not_configured",
            "AI recommendations aren't available right now. Manual search still works."
          )
        if (input.recap && !validRecapRequest(input.recap))
          return yield* fail("invalid", "Choose a valid episode range.")
        const kind = input.recap ? "recap" : "recommend"
        const prepared = yield* prepareSend(
          actor,
          input,
          kind,
          reservationUsd[kind]
        )

        if (prepared.job && "history" in prepared) {
          const { history, lastRecap } = prepared
          const conversation: Array<AiMessage> = [
            ...(lastRecap && !history.some((row) => row.id === lastRecap.id)
              ? [lastRecap]
              : []),
            ...history,
          ]
            .filter((row) => row.status === "complete" && row.content)
            .map((row) => ({ role: row.role, content: historyContent(row) }))
          const earlier = prepared.history.flatMap(
            (row) => dataOf(row.data).suggested ?? []
          )
          const seed =
            ((prepared.thread.context ?? {}) as { seed?: AnimeLibraryMetadata })
              .seed ?? null
          const owner = prepared.owner
          const messageId = prepared.job.assistantMessageId
          const work: Effect.Effect<Outcome, RecommendationOperationError> =
            input.recap
              ? recap(input.recap, messageId)
              : assist({
                  scope: "personal",
                  conversation,
                  userId: owner.kind === "account" ? owner.userId : null,
                  groupTaste: "",
                  seed,
                  earlier,
                  messageId,
                })
          yield* launch(prepared.job, work, {
            roomId: owner.kind === "guest" ? owner.roomId : null,
            allowed:
              owner.kind === "guest"
                ? guestStillAllowed(prepared.thread.id, owner)
                : Effect.succeed(true),
          })
        }
        return yield* run(loadThread(prepared.thread))
        // Uninterruptible from reservation to launch: a dropped request must
        // not leave a reserved generation without its settling finalizer.
      }, Effect.uninterruptible)

      const stop = Effect.fn("RecommendationService.stop")(function* (
        actor: Actor,
        threadId: string
      ) {
        yield* run(requireThread(actor, threadId))
        yield* stopThread(threadId)
      })

      const prepareAskRoom = Effect.fnUntraced(function* (
        actor: Actor,
        roomId: string,
        requestId: string,
        content: string,
        amount: number
      ) {
        const [roomRow] = yield* query((db) =>
          db.select().from(room).where(eq(room.id, roomId)).for("update")
        )
        const { account, guest } = yield* findParticipants(actor, roomId)
        const participant = account ?? guest
        const now = yield* Clock.currentTimeMillis
        if (
          !participant ||
          !roomRow ||
          participantState(participant, now) !== "admitted"
        )
          return yield* fail("forbidden", "Join the room first.")
        const isHost =
          actor.user !== null && roomRow.hostUserId === actor.user.id
        if (!canAskAi(roomRow.aiAccess, isHost, roomRow.status))
          return yield* fail(
            "forbidden",
            "The host hasn't allowed you to ask AI in this room."
          )
        const [existing] = yield* query((db) =>
          db
            .select({ id: aiGeneration.id })
            .from(aiGeneration)
            .where(
              and(
                eq(aiGeneration.actorKey, `participant:${participant.id}`),
                eq(aiGeneration.requestId, requestId)
              )
            )
        )
        if (existing) return null
        const [busy] = yield* query((db) =>
          db
            .select({ id: aiGeneration.id })
            .from(aiGeneration)
            .where(
              and(
                eq(aiGeneration.roomId, roomId),
                eq(aiGeneration.status, "running"),
                sql`${aiGeneration.threadId} is null`
              )
            )
        )
        if (busy)
          return yield* fail(
            "busy",
            "Someone's AI request is still running in this room."
          )
        const reservedAt = new Date(now)
        yield* reserve({
          actorKey:
            participant.kind === "account" && participant.userId
              ? `user:${participant.userId}`
              : `guest:${participant.id}`,
          actorLimit:
            participant.kind === "account"
              ? aiLimits.userDaily
              : aiLimits.guestDaily,
          roomId,
          amount,
          at: reservedAt,
        })
        const [generation] = yield* query((db) =>
          db
            .insert(aiGeneration)
            .values({
              requestId,
              actorKey: `participant:${participant.id}`,
              roomId,
              kind: "recommend",
              status: "running",
              model: provider.model,
              reservedUsd: String(amount),
              createdAt: reservedAt,
            })
            .returning()
        )
        if (!generation)
          return yield* fail("failed", "Unable to start the request.")
        const taste = yield* roomTaste(roomId)
        yield* postToRoom({
          roomId,
          participantId: participant.id,
          kind: "text",
          body: content,
          data: { aiRequest: true },
          requestId,
        })
        yield* notifyRoom(roomId)
        return { generation, participant, taste }
      }, transact)

      const participantMayAsk = Effect.fnUntraced(function* (
        roomId: string,
        participantId: string
      ) {
        const roomRow = yield* findRoom(roomId)
        const [participant] = yield* query((db) =>
          db
            .select()
            .from(roomParticipant)
            .where(eq(roomParticipant.id, participantId))
        )
        if (!roomRow || !participant || participant.state !== "admitted")
          return false
        const isHost =
          participant.userId !== null &&
          participant.userId === roomRow.hostUserId
        return canAskAi(roomRow.aiAccess, isHost, roomRow.status)
      })

      const askRoom = Effect.fn("RecommendationService.askRoom")(function* (
        actor: Actor,
        roomId: string,
        requestId: string,
        content: string
      ) {
        if (!provider.run)
          return yield* fail(
            "not_configured",
            "Room AI isn't available right now. Picks and search still work."
          )
        const amount = reservationUsd.recommend
        const prepared = yield* prepareAskRoom(
          actor,
          roomId,
          requestId,
          content,
          amount
        )
        if (!prepared) return
        const job: Job = {
          generationId: prepared.generation.id,
          threadId: null,
          roomId,
          assistantMessageId: null,
          amount,
        }
        const participantId = prepared.participant.id
        yield* launch(
          job,
          assist({
            scope: "room",
            conversation: [{ role: "user", content }],
            userId: null,
            groupTaste: prepared.taste,
            seed: null,
            earlier: [],
            messageId: null,
          }),
          {
            roomId,
            allowed: participantMayAsk(roomId, participantId),
            publish: (outcome) =>
              postToRoom({
                roomId,
                participantId: null,
                kind: "ai",
                body: outcome.content,
                data: {
                  cards: outcome.data.cards ?? [],
                  requestedBy: participantId,
                },
              }).pipe(Effect.asVoid),
          }
        )
      }, Effect.uninterruptible)

      const stopRoom = Effect.fn("RecommendationService.stopRoom")(function* (
        actor: Actor,
        roomId: string
      ) {
        const generations = yield* transact(
          Effect.gen(function* () {
            const { account, guest } = yield* findParticipants(actor, roomId)
            const participant = account ?? guest
            const roomRow = yield* findRoom(roomId)
            if (!participant || !roomRow)
              return yield* fail("forbidden", "Join the room first.")
            const isHost =
              actor.user !== null && roomRow.hostUserId === actor.user.id
            return yield* query((db) =>
              db
                .select()
                .from(aiGeneration)
                .where(
                  and(
                    eq(aiGeneration.roomId, roomId),
                    eq(aiGeneration.status, "running"),
                    sql`${aiGeneration.threadId} is null`,
                    isHost
                      ? undefined
                      : eq(
                          aiGeneration.actorKey,
                          `participant:${participant.id}`
                        )
                  )
                )
            )
          })
        )
        yield* Effect.forEach(generations, (row) =>
          stopGeneration(row.id, Number(row.reservedUsd)).pipe(Effect.ignore)
        )
      })

      const sharedMessage = Effect.fnUntraced(function* (
        userId: string,
        input: { roomId: string; threadId: string; messageId: string }
      ) {
        const [row] = yield* query((db) =>
          db
            .select({ message: recommendationMessage })
            .from(recommendationMessage)
            .innerJoin(
              recommendationThread,
              eq(recommendationThread.id, recommendationMessage.threadId)
            )
            .where(
              and(
                eq(recommendationMessage.id, input.messageId),
                eq(recommendationThread.id, input.threadId),
                eq(recommendationThread.ownerUserId, userId)
              )
            )
        )
        const [participant] = yield* query((db) =>
          db
            .select()
            .from(roomParticipant)
            .where(
              and(
                eq(roomParticipant.roomId, input.roomId),
                eq(roomParticipant.userId, userId),
                eq(roomParticipant.state, "admitted")
              )
            )
        )
        if (!row || !participant)
          return yield* fail("not_found", "That couldn't be shared.")
        return {
          data: dataOf(row.message.data),
          participantId: participant.id,
        }
      }, run)

      const share = Effect.fn("RecommendationService.share")(function* (
        userId: string,
        input: {
          roomId: string
          threadId: string
          messageId: string
          malId?: number
        }
      ) {
        const message = yield* sharedMessage(userId, input)
        if (input.malId !== undefined) {
          const card = message.data.cards?.find(
            (entry) => entry.anime.malId === input.malId
          )
          if (!card)
            return yield* fail("not_found", "That card couldn't be shared.")
          yield* rooms
            .insertMessage({
              roomId: input.roomId,
              participantId: message.participantId,
              kind: "recommendation",
              body: `Suggested ${titleOf(card.anime)}`,
              data: {
                anime: card.anime,
                format: card.format,
                sequel: card.sequel,
              },
            })
            .pipe(Effect.mapError(() => fail("failed", "Unable to share.")))
          return
        }
        const recapData = message.data.recap
        if (!recapData)
          return yield* fail("not_found", "That recap couldn't be shared.")
        yield* rooms
          .insertMessage({
            roomId: input.roomId,
            participantId: message.participantId,
            kind: "recap",
            body: `Recap shared · ${recapData.contains.replace(/^Contains spoilers for /, "")} spoilers`,
            data: {
              contains: recapData.contains,
              excludes: recapData.excludes,
              sections: recapData.sections,
              sources: recapData.sources,
              gaps: recapData.gaps,
            },
          })
          .pipe(Effect.mapError(() => fail("failed", "Unable to share.")))
      })

      // Generations whose process died cannot report usage: they settle at
      // their full reservation and their messages offer an explicit retry.
      const recoverAfterRestart = Effect.fn(
        "RecommendationService.recoverAfterRestart"
      )(function* () {
        const finishedAt = new Date(yield* Clock.currentTimeMillis)
        const stale = yield* query((db) =>
          db
            .update(aiGeneration)
            .set({
              status: "interrupted",
              finishedAt,
              error: "Interrupted by a restart.",
            })
            .where(eq(aiGeneration.status, "running"))
            .returning()
        )
        for (const generation of stale) {
          yield* settle(
            Number(generation.reservedUsd),
            null,
            monthOf(generation.createdAt)
          )
          yield* query((db) =>
            db
              .update(recommendationMessage)
              .set({
                status: "interrupted",
                content: "Interrupted. Try again.",
              })
              .where(eq(recommendationMessage.generationId, generation.id))
          )
          if (generation.threadId) yield* notifyThread(generation.threadId)
        }
      }, transact)

      return {
        model: provider.model ?? AiModelId,
        availability,
        list,
        create,
        get,
        watch,
        rename,
        remove,
        getPreferences,
        savePreferences,
        send,
        stop,
        askRoom,
        stopRoom,
        share,
        recoverAfterRestart,
      }
    }),
  }
) {
  static readonly layer = Layer.effect(
    RecommendationService,
    RecommendationService.make
  ).pipe(
    Layer.provide([RoomService.layer, AnimeService.layer, ThreadEvents.layer])
  )
}
