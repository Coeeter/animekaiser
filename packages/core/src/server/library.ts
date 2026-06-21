import {
  animeMetadata,
  Database,
  externalListAccount,
  libraryStatuses,
  librarySyncEvent,
  userLibraryEntry,
} from "@workspace/db"
import type { DatabaseError } from "@workspace/db"
import type {
  AnimeLibraryMetadata,
  ExternalListProvider,
  LibraryEntry,
  LibrarySort,
  LibraryStatus,
  LibrarySyncRetryTarget,
} from "@workspace/domain"
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

export const LIBRARY_SYNC_EVENT_CHANNEL = "library_sync_events"

export class LibraryServiceError extends Schema.TaggedError<LibraryServiceError>()(
  "LibraryServiceError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}

type EntryState = {
  status: LibraryStatus
  score: number | null
  progress: number
  notes: string | null
}

const toEntry = (row: {
  entry: typeof userLibraryEntry.$inferSelect
  anime: typeof animeMetadata.$inferSelect
}): LibraryEntry => ({
  malId: row.entry.malId,
  status: row.entry.status,
  score: row.entry.score,
  progress: row.entry.progress,
  notes: row.entry.notes,
  aniListEntryId: row.entry.aniListEntryId,
  anime: {
    malId: row.anime.malId,
    aniListId: row.anime.aniListId,
    title: { romaji: row.anime.titleRomaji, english: row.anime.titleEnglish },
    coverImage: row.anime.coverImage,
    episodes: row.anime.episodes,
  },
  createdAt: row.entry.createdAt,
  updatedAt: row.entry.updatedAt,
})

const dbError =
  (message: string) =>
  <TValue, TRequirements>(
    effect: Effect.Effect<TValue, DatabaseError, TRequirements>
  ) =>
    effect.pipe(
      Effect.mapError((cause) => new LibraryServiceError({ message, cause }))
    )

const listOrder = (sort: LibrarySort) => {
  if (sort === "updated_asc") return [asc(userLibraryEntry.updatedAt)]
  if (sort === "title_asc") return [asc(animeMetadata.titleRomaji)]
  if (sort === "score_desc")
    return [desc(userLibraryEntry.score), desc(userLibraryEntry.updatedAt)]
  if (sort === "progress_desc") {
    return [desc(userLibraryEntry.progress), desc(userLibraryEntry.updatedAt)]
  }
  return [desc(userLibraryEntry.updatedAt)]
}

export class LibraryService extends Effect.Service<LibraryService>()(
  "@workspace/core/server/LibraryService",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const database = yield* Database

      const linkedProviders = Effect.fn("LibraryService.linkedProviders")(
        function* (userId: string) {
          const rows = yield* database
            .execute((db) =>
              db
                .select({ provider: externalListAccount.provider })
                .from(externalListAccount)
                .where(eq(externalListAccount.userId, userId))
            )
            .pipe(dbError("Unable to load linked providers."))
          return rows.map((row) => row.provider)
        }
      )

      const enqueue = Effect.fn("LibraryService.enqueue")(function* (
        userId: string,
        malId: number,
        providers: ReadonlyArray<ExternalListProvider>,
        action: "upsert" | "delete",
        payload: typeof librarySyncEvent.$inferInsert.payload,
        sourceEventId: string | null = null
      ) {
        if (providers.length === 0) return []
        return yield* database
          .execute((db) =>
            db.transaction(async (tx) => {
              await tx
                .update(librarySyncEvent)
                .set({ status: "superseded", updatedAt: new Date() })
                .where(
                  and(
                    eq(librarySyncEvent.userId, userId),
                    eq(librarySyncEvent.malId, malId),
                    inArray(librarySyncEvent.provider, [...providers]),
                    eq(librarySyncEvent.status, "pending")
                  )
                )
              const values = providers.map((provider) => ({
                id: crypto.randomUUID(),
                sourceEventId,
                userId,
                malId,
                provider,
                action,
                payload,
              }))
              const rows = await tx
                .insert(librarySyncEvent)
                .values(values)
                .returning()
              for (const row of rows) {
                await tx.execute(
                  sql`select pg_notify(${LIBRARY_SYNC_EVENT_CHANNEL}, ${row.id})`
                )
              }
              return rows
            })
          )
          .pipe(dbError("Unable to queue library sync."))
      })

      const getEntry = Effect.fn("LibraryService.getEntry")(function* (
        userId: string,
        malId: number
      ) {
        const rows = yield* database
          .execute((db) =>
            db
              .select({ entry: userLibraryEntry, anime: animeMetadata })
              .from(userLibraryEntry)
              .innerJoin(
                animeMetadata,
                eq(userLibraryEntry.malId, animeMetadata.malId)
              )
              .where(
                and(
                  eq(userLibraryEntry.userId, userId),
                  eq(userLibraryEntry.malId, malId)
                )
              )
              .limit(1)
          )
          .pipe(dbError("Unable to load library entry."))
        return rows[0] ? toEntry(rows[0]) : null
      })

      const getStats = Effect.fn("LibraryService.getStats")(function* (
        userId: string
      ) {
        const rows = yield* database
          .execute((db) =>
            db
              .select({
                status: userLibraryEntry.status,
                score: userLibraryEntry.score,
              })
              .from(userLibraryEntry)
              .where(eq(userLibraryEntry.userId, userId))
          )
          .pipe(dbError("Unable to load library statistics."))
        const byStatus = Object.fromEntries(
          libraryStatuses.map((status) => [status, 0])
        ) as Record<LibraryStatus, number>
        let scoreTotal = 0
        let scoreCount = 0
        for (const row of rows) {
          byStatus[row.status] += 1
          if (row.score !== null) {
            scoreTotal += row.score
            scoreCount += 1
          }
        }
        return {
          total: rows.length,
          byStatus,
          meanScore: scoreCount ? Math.round(scoreTotal / scoreCount) : null,
        }
      })

      const getPage = Effect.fn("LibraryService.getPage")(function* (
        userId: string,
        input: {
          status?: LibraryStatus
          sort: LibrarySort
          page: number
          perPage: number
        }
      ) {
        const where = input.status
          ? and(
              eq(userLibraryEntry.userId, userId),
              eq(userLibraryEntry.status, input.status)
            )
          : eq(userLibraryEntry.userId, userId)
        const [rows, totals, stats] = yield* Effect.all(
          [
            database
              .execute((db) =>
                db
                  .select({ entry: userLibraryEntry, anime: animeMetadata })
                  .from(userLibraryEntry)
                  .innerJoin(
                    animeMetadata,
                    eq(userLibraryEntry.malId, animeMetadata.malId)
                  )
                  .where(where)
                  .orderBy(...listOrder(input.sort))
                  .limit(input.perPage)
                  .offset((input.page - 1) * input.perPage)
              )
              .pipe(dbError("Unable to load library.")),
            database
              .execute((db) =>
                db
                  .select({ value: count() })
                  .from(userLibraryEntry)
                  .where(where)
              )
              .pipe(dbError("Unable to count library entries.")),
            getStats(userId),
          ],
          { concurrency: 3 }
        )
        const total = totals[0]?.value ?? 0
        return {
          items: rows.map(toEntry),
          page: input.page,
          perPage: input.perPage,
          total,
          totalPages: Math.max(1, Math.ceil(total / input.perPage)),
          stats,
        }
      })

      const upsertEntry = Effect.fn("LibraryService.upsertEntry")(function* (
        userId: string,
        metadata: AnimeLibraryMetadata,
        state: EntryState
      ) {
        yield* database
          .execute((db) =>
            db.transaction(async (tx) => {
              await tx
                .insert(animeMetadata)
                .values({
                  malId: metadata.malId,
                  aniListId: metadata.aniListId,
                  titleRomaji: metadata.title.romaji,
                  titleEnglish: metadata.title.english,
                  coverImage: metadata.coverImage,
                  episodes: metadata.episodes,
                })
                .onConflictDoUpdate({
                  target: animeMetadata.malId,
                  set: {
                    aniListId: metadata.aniListId,
                    titleRomaji: metadata.title.romaji,
                    titleEnglish: metadata.title.english,
                    coverImage: metadata.coverImage,
                    episodes: metadata.episodes,
                    updatedAt: new Date(),
                  },
                })
              await tx
                .insert(userLibraryEntry)
                .values({ userId, malId: metadata.malId, ...state })
                .onConflictDoUpdate({
                  target: [userLibraryEntry.userId, userLibraryEntry.malId],
                  set: { ...state, updatedAt: new Date() },
                })
            })
          )
          .pipe(dbError("Unable to save library entry."))
        const providers = yield* linkedProviders(userId)
        yield* enqueue(userId, metadata.malId, providers, "upsert", {
          ...state,
          aniListId: metadata.aniListId,
          aniListEntryId: null,
        })
        return yield* getEntry(userId, metadata.malId)
      })

      const removeEntry = Effect.fn("LibraryService.removeEntry")(function* (
        userId: string,
        malId: number,
        providers: ReadonlyArray<ExternalListProvider>
      ) {
        const entry = yield* getEntry(userId, malId)
        if (!entry) return { removed: false, queuedProviders: [] }
        yield* database
          .execute((db) =>
            db
              .delete(userLibraryEntry)
              .where(
                and(
                  eq(userLibraryEntry.userId, userId),
                  eq(userLibraryEntry.malId, malId)
                )
              )
          )
          .pipe(dbError("Unable to remove library entry."))
        const linked = yield* linkedProviders(userId)
        const selected = providers.filter((provider) =>
          linked.includes(provider)
        )
        yield* enqueue(userId, malId, selected, "delete", {
          status: entry.status,
          score: entry.score,
          progress: entry.progress,
          notes: entry.notes,
          aniListId: entry.anime.aniListId,
          aniListEntryId: entry.aniListEntryId,
        })
        return { removed: true, queuedProviders: selected }
      })

      const clear = Effect.fn("LibraryService.clear")(function* (
        userId: string
      ) {
        return yield* database
          .execute((db) =>
            db.transaction(async (tx) => {
              await tx
                .update(librarySyncEvent)
                .set({ status: "superseded", updatedAt: new Date() })
                .where(
                  and(
                    eq(librarySyncEvent.userId, userId),
                    eq(librarySyncEvent.status, "pending")
                  )
                )
              const deleted = await tx
                .delete(userLibraryEntry)
                .where(eq(userLibraryEntry.userId, userId))
                .returning({ malId: userLibraryEntry.malId })
              return deleted.length
            })
          )
          .pipe(dbError("Unable to clear library."))
      })

      const listSyncEvents = Effect.fn("LibraryService.listSyncEvents")(
        function* (
          userId: string,
          input: {
            page: number
            perPage: number
            status?: typeof librarySyncEvent.$inferSelect.status
            provider?: ExternalListProvider
          }
        ) {
          const clauses = [eq(librarySyncEvent.userId, userId)]
          if (input.status)
            clauses.push(eq(librarySyncEvent.status, input.status))
          if (input.provider)
            clauses.push(eq(librarySyncEvent.provider, input.provider))
          const where = and(...clauses)
          const [rows, totals] = yield* Effect.all([
            database
              .execute((db) =>
                db
                  .select({ event: librarySyncEvent, anime: animeMetadata })
                  .from(librarySyncEvent)
                  .innerJoin(
                    animeMetadata,
                    eq(librarySyncEvent.malId, animeMetadata.malId)
                  )
                  .where(where)
                  .orderBy(desc(librarySyncEvent.createdAt))
                  .limit(input.perPage)
                  .offset((input.page - 1) * input.perPage)
              )
              .pipe(dbError("Unable to load sync activity.")),
            database
              .execute((db) =>
                db
                  .select({ value: count() })
                  .from(librarySyncEvent)
                  .where(where)
              )
              .pipe(dbError("Unable to count sync activity.")),
          ])
          const total = totals[0]?.value ?? 0
          return {
            items: rows.map(({ event, anime }) => ({
              id: event.id,
              sourceEventId: event.sourceEventId,
              malId: event.malId,
              provider: event.provider,
              action: event.action,
              status: event.status,
              title: anime.titleEnglish ?? anime.titleRomaji,
              attempts: event.attempts,
              errorMessage: event.errorMessage,
              createdAt: event.createdAt,
              updatedAt: event.updatedAt,
            })),
            page: input.page,
            perPage: input.perPage,
            total,
            totalPages: Math.max(1, Math.ceil(total / input.perPage)),
          }
        }
      )

      const retrySyncEvents = Effect.fn("LibraryService.retrySyncEvents")(
        function* (
          userId: string,
          eventIds: ReadonlyArray<string>,
          target: typeof LibrarySyncRetryTarget.Type
        ) {
          const events = yield* database
            .execute((db) =>
              db
                .select()
                .from(librarySyncEvent)
                .where(
                  and(
                    eq(librarySyncEvent.userId, userId),
                    eq(librarySyncEvent.status, "failed"),
                    inArray(librarySyncEvent.id, [...eventIds])
                  )
                )
            )
            .pipe(dbError("Unable to load failed sync events."))
          const linked = yield* linkedProviders(userId)
          const queued: Array<typeof librarySyncEvent.$inferSelect> = []
          for (const event of events) {
            const providers =
              target.type === "original"
                ? linked.includes(event.provider)
                  ? [event.provider]
                  : []
                : target.type === "all_linked"
                  ? linked
                  : target.providers.filter((provider) =>
                      linked.includes(provider)
                    )
            const current = yield* getEntry(userId, event.malId)
            const action = event.action === "delete" ? "delete" : "upsert"
            let payload = event.payload
            if (action === "upsert") {
              if (!current) continue
              payload = {
                status: current.status,
                score: current.score,
                progress: current.progress,
                notes: current.notes,
                aniListId: current.anime.aniListId,
                aniListEntryId: current.aniListEntryId,
              }
            }
            queued.push(
              ...(yield* enqueue(
                userId,
                event.malId,
                providers,
                action,
                payload,
                event.id
              ))
            )
          }
          return queued
        }
      )

      return {
        getEntry,
        getPage,
        upsertEntry,
        removeEntry,
        clear,
        listSyncEvents,
        retrySyncEvents,
      }
    }),
  }
) {}
