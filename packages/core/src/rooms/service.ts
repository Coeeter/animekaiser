import type { KaiserDb, KaiserExecutor } from "@animekaiser/db"
import {
  aiGeneration,
  animeMetadata,
  Database,
  friendship,
  recommendationThread,
  room,
  roomConnection,
  roomInviteLink,
  roomMessage,
  roomParticipant,
  roomPick,
  roomVote,
  thrownBy,
  user,
  watchCoverage,
  watchHistory,
} from "@animekaiser/db"
import type {
  AnimeLibraryMetadata,
  RoomAccess,
  RoomActorShape,
  RoomAdmission,
  RoomAiAccess,
  RoomEndReason,
  RoomEpisodeSelection,
  RoomEvent,
  RoomListTab,
  RoomMember,
  RoomMessage,
  RoomMessageKind,
  RoomPlaybackAction,
  RoomPlaybackControl,
  RoomPlaybackState,
  RoomState,
  RoomSummary,
} from "@animekaiser/domain"
import { RoomCapacity, RoomOperationError } from "@animekaiser/domain"
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm"
import * as Clock from "effect/Clock"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import {
  type AdmissionFacts,
  admissionError,
  decideAdmission,
  type ParticipantState,
} from "./access"
import {
  acceptedSegment,
  coveredSeconds,
  isCoverageComplete,
  mergeIntervals,
} from "./coverage"
import { notifyRoom, RoomEvents } from "./events"
import { projectPosition } from "./playback"
import { createOpaqueToken, hashToken } from "./tokens"

type RoomRow = typeof room.$inferSelect
type ParticipantRow = typeof roomParticipant.$inferSelect
type Actor = RoomActorShape

const presenceTimeoutMs = 90_000
const hostGraceMs = 30_000
const idleCloseMs = 24 * 60 * 60 * 1000
const retentionMs = 30 * 24 * 60 * 60 * 1000
const guestSessionMs = 24 * 60 * 60 * 1000
const inviteLinkMs = 7 * 24 * 60 * 60 * 1000
const initialMessageCount = 50
const maxPicks = 50
const maxActiveLinks = 20

const fail = (
  reason: RoomOperationError["reason"],
  message: string
): RoomOperationError => new RoomOperationError({ reason, message })

const userDisplayName = (
  value: {
    name: string | null
    username: string | null
    displayUsername: string | null
  } | null
) => (value ? (value.displayUsername ?? value.username ?? value.name) : null)

const userFields = {
  name: user.name,
  username: user.username,
  displayUsername: user.displayUsername,
  image: user.image,
}

const toAnime = (
  row: typeof animeMetadata.$inferSelect
): AnimeLibraryMetadata => ({
  malId: row.malId,
  aniListId: row.aniListId,
  title: { romaji: row.titleRomaji, english: row.titleEnglish },
  coverImage: row.coverImage,
  episodes: row.episodes,
  genres: row.genres,
  seasonYear: row.seasonYear,
})

const upsertAnime = (ex: KaiserExecutor, anime: AnimeLibraryMetadata) =>
  ex
    .insert(animeMetadata)
    .values({
      malId: anime.malId,
      aniListId: anime.aniListId,
      titleRomaji: anime.title.romaji,
      titleEnglish: anime.title.english,
      coverImage: anime.coverImage,
      episodes: anime.episodes,
      genres: anime.genres ? [...anime.genres] : [],
      seasonYear: anime.seasonYear ?? null,
    })
    .onConflictDoNothing({ target: animeMetadata.malId })

const animeTitle = (anime: AnimeLibraryMetadata) =>
  anime.title.english ?? anime.title.romaji

const liveCutoff = (now: number) => new Date(now - presenceTimeoutMs)

const areFriends = async (ex: KaiserExecutor, left: string, right: string) => {
  if (left === right) return true
  const [low, high] = left < right ? [left, right] : [right, left]
  const rows = await ex
    .select({ status: friendship.status })
    .from(friendship)
    .where(
      and(
        eq(friendship.userLowId, low),
        eq(friendship.userHighId, high),
        eq(friendship.status, "accepted")
      )
    )
  return rows.length > 0
}

export const friendIdsOf = async (ex: KaiserExecutor, userId: string) => {
  const rows = await ex
    .select({ low: friendship.userLowId, high: friendship.userHighId })
    .from(friendship)
    .where(
      and(
        eq(friendship.status, "accepted"),
        or(eq(friendship.userLowId, userId), eq(friendship.userHighId, userId))
      )
    )
  return rows.map((row) => (row.low === userId ? row.high : row.low))
}

const onlineParticipants = async (
  ex: KaiserExecutor,
  roomId: string,
  now: number
) => {
  const rows = await ex
    .selectDistinct({ participantId: roomConnection.participantId })
    .from(roomConnection)
    .where(
      and(
        eq(roomConnection.roomId, roomId),
        gt(roomConnection.lastSeenAt, liveCutoff(now))
      )
    )
  return new Set(rows.map((row) => row.participantId))
}

const validLink = async (
  ex: KaiserExecutor,
  roomId: string,
  token: string | undefined,
  now: number
) => {
  if (!token) return false
  const rows = await ex
    .select({ id: roomInviteLink.id })
    .from(roomInviteLink)
    .where(
      and(
        eq(roomInviteLink.roomId, roomId),
        eq(roomInviteLink.tokenHash, hashToken(token)),
        isNull(roomInviteLink.revokedAt),
        gt(roomInviteLink.expiresAt, new Date(now))
      )
    )
  return rows.length > 0
}

export const findParticipants = async (
  ex: KaiserExecutor,
  actor: Actor,
  roomId: string
) => {
  const hashes = actor.guestTokens.map(hashToken)
  const conditions = [
    actor.user ? eq(roomParticipant.userId, actor.user.id) : undefined,
    hashes.length > 0
      ? inArray(roomParticipant.guestTokenHash, hashes)
      : undefined,
  ].filter((condition) => condition !== undefined)
  if (conditions.length === 0) return { account: null, guest: null }
  const rows = await ex
    .select()
    .from(roomParticipant)
    .where(and(eq(roomParticipant.roomId, roomId), or(...conditions)))
  return {
    account:
      rows.find((row) => actor.user !== null && row.userId === actor.user.id) ??
      null,
    guest: rows.find((row) => row.kind === "guest") ?? null,
  }
}

export const participantState = (
  participant: ParticipantRow,
  now: number
): ParticipantState =>
  participant.kind === "guest" &&
  participant.state === "admitted" &&
  (participant.guestExpiresAt?.getTime() ?? 0) <= now
    ? "expired"
    : participant.state

type ViewerContext = {
  room: RoomRow
  participant: ParticipantRow | null
  isHost: boolean
  facts: AdmissionFacts
  status: ReturnType<typeof decideAdmission>
}

const loadViewer = async (
  ex: KaiserExecutor,
  actor: Actor,
  roomId: string,
  now: number,
  options: { inviteToken?: string; lock?: boolean } = {}
): Promise<ViewerContext | null> => {
  const query = ex.select().from(room).where(eq(room.id, roomId))
  const [roomRow] = options.lock ? await query.for("update") : await query
  if (!roomRow) return null
  const { account, guest } = await findParticipants(ex, actor, roomId)
  const participant = account ?? guest
  const isHost = actor.user !== null && roomRow.hostUserId === actor.user.id
  const online = await onlineParticipants(ex, roomId, now)
  const facts: AdmissionFacts = {
    roomOpen: roomRow.status === "open",
    access: roomRow.access,
    signedIn: actor.user !== null,
    isHost,
    isHostFriend:
      actor.user !== null && roomRow.hostUserId !== null
        ? await areFriends(ex, actor.user.id, roomRow.hostUserId)
        : false,
    participant: participant
      ? {
          state: participantState(participant, now),
          guest: participant.kind === "guest",
        }
      : null,
    validLink: await validLink(ex, roomId, options.inviteToken, now),
    onlineCount: online.size,
    alreadyOnline: participant ? online.has(participant.id) : false,
  }
  return {
    room: roomRow,
    participant,
    isHost,
    facts,
    status: decideAdmission(facts),
  }
}

const requireMember = async (
  ex: KaiserExecutor,
  actor: Actor,
  roomId: string,
  now: number,
  options: { lock?: boolean; open?: boolean } = {}
) => {
  const context = await loadViewer(ex, actor, roomId, now, options)
  if (!context) throw fail("unavailable", "This room is unavailable.")
  if (context.status !== "member" || !context.participant)
    throw fail("not_member", "You are not a member of this room.")
  if (options.open && context.room.status !== "open")
    throw fail("closed", "This room has closed.")
  return { ...context, participant: context.participant }
}

const requireHost = async (
  ex: KaiserExecutor,
  actor: Actor,
  roomId: string,
  now: number,
  options: { lock?: boolean } = { lock: true }
) => {
  const context = await requireMember(ex, actor, roomId, now, {
    ...options,
    open: true,
  })
  if (!context.isHost) throw fail("not_host", "Only the host can change this.")
  return context
}

export const insertMessage = async (
  ex: KaiserExecutor,
  input: {
    roomId: string
    participantId: string | null
    kind: RoomMessageKind
    body: string
    data?: unknown
    requestId?: string
  }
) => {
  if (input.requestId && input.participantId) {
    const [existing] = await ex
      .select()
      .from(roomMessage)
      .where(
        and(
          eq(roomMessage.roomId, input.roomId),
          eq(roomMessage.participantId, input.participantId),
          eq(roomMessage.requestId, input.requestId)
        )
      )
    if (existing) return existing
  }
  const [counter] = await ex
    .update(room)
    .set({ messageSeq: sql`${room.messageSeq} + 1` })
    .where(eq(room.id, input.roomId))
    .returning({ seq: room.messageSeq })
  if (!counter) throw fail("unavailable", "This room is unavailable.")
  const [message] = await ex
    .insert(roomMessage)
    .values({
      roomId: input.roomId,
      seq: counter.seq,
      participantId: input.participantId,
      kind: input.kind,
      body: input.body,
      data: input.data ?? null,
      requestId: input.requestId ?? null,
    })
    .returning()
  if (!message) throw fail("failed", "Unable to send the message.")
  return message
}

const systemMessage = (
  ex: KaiserExecutor,
  roomId: string,
  body: string,
  data?: unknown
) =>
  insertMessage(ex, { roomId, participantId: null, kind: "system", body, data })

const participantName = async (
  ex: KaiserExecutor,
  participant: ParticipantRow
) => {
  if (participant.kind === "guest") return participant.displayName ?? "Guest"
  if (!participant.userId) return "Deleted user"
  const [row] = await ex
    .select(userFields)
    .from(user)
    .where(eq(user.id, participant.userId))
  return userDisplayName(row ?? null) ?? "Deleted user"
}

const bumpRevision = { revision: sql`${room.revision} + 1` }

const messageSelection = {
  message: roomMessage,
  participantKind: roomParticipant.kind,
  participantUserId: roomParticipant.userId,
  guestName: roomParticipant.displayName,
  ...userFields,
}

type MessageRow = {
  message: typeof roomMessage.$inferSelect
  participantKind: "account" | "guest" | null
  participantUserId: string | null
  guestName: string | null
  name: string | null
  username: string | null
  displayUsername: string | null
  image: string | null
}

const toMessage = (row: MessageRow): RoomMessage => {
  const { message } = row
  const deleted = message.deletedAt !== null
  const author = ((): Pick<RoomMessage, "authorName" | "authorKind"> => {
    if (message.kind === "system")
      return { authorName: "Room", authorKind: "system" }
    if (message.kind === "ai")
      return { authorName: "Kaiser AI", authorKind: "ai" }
    if (row.participantKind === "guest")
      return { authorName: row.guestName ?? "Guest", authorKind: "guest" }
    if (row.participantKind === "account" && row.participantUserId)
      return {
        authorName: userDisplayName(row) ?? "Deleted user",
        authorKind: "account",
      }
    return { authorName: "Deleted user", authorKind: "deleted" }
  })()
  return {
    id: message.id,
    seq: message.seq,
    participantId: message.participantId,
    ...author,
    kind: message.kind,
    body: deleted ? "" : message.body,
    data: deleted ? null : (message.data ?? null),
    deleted,
    createdAt: message.createdAt.getTime(),
  }
}

const selectMessages = (ex: KaiserExecutor) =>
  ex
    .select(messageSelection)
    .from(roomMessage)
    .leftJoin(
      roomParticipant,
      eq(roomParticipant.id, roomMessage.participantId)
    )
    .leftJoin(user, eq(user.id, roomParticipant.userId))

const latestMessages = async (
  ex: KaiserExecutor,
  roomId: string,
  beforeSeq: number | null
) => {
  const rows = await selectMessages(ex)
    .where(
      and(
        eq(roomMessage.roomId, roomId),
        beforeSeq === null ? undefined : lt(roomMessage.seq, beforeSeq)
      )
    )
    .orderBy(desc(roomMessage.seq))
    .limit(initialMessageCount + 1)
  const page = rows.slice(0, initialMessageCount).reverse().map(toMessage)
  return { messages: page, hasEarlier: rows.length > initialMessageCount }
}

const loadState = async (
  ex: KaiserExecutor,
  context: ViewerContext & { participant: ParticipantRow },
  connectionId: string | null,
  now: number
): Promise<RoomState> => {
  const roomRow = context.room
  const memberRows = await ex
    .select({ participant: roomParticipant, ...userFields })
    .from(roomParticipant)
    .leftJoin(user, eq(user.id, roomParticipant.userId))
    .where(
      and(
        eq(roomParticipant.roomId, roomRow.id),
        eq(roomParticipant.state, "admitted")
      )
    )
    .orderBy(asc(roomParticipant.admittedAt))
  const hostFriends =
    roomRow.access === "friends" && roomRow.hostUserId
      ? new Set(await friendIdsOf(ex, roomRow.hostUserId))
      : null
  const connections = await ex
    .select()
    .from(roomConnection)
    .where(
      and(
        eq(roomConnection.roomId, roomRow.id),
        gt(roomConnection.lastSeenAt, liveCutoff(now))
      )
    )

  const visibleMembers = memberRows.filter(({ participant }) => {
    if (participantState(participant, now) !== "admitted") return false
    if (!hostFriends || participant.userId === roomRow.hostUserId) return true
    return (
      participant.kind === "account" &&
      participant.userId !== null &&
      hostFriends.has(participant.userId)
    )
  })

  const members: Array<RoomMember> = visibleMembers.map(
    ({ participant, ...account }) => {
      const own = connections.filter(
        (connection) => connection.participantId === participant.id
      )
      const controller = own.find((connection) => connection.controller)
      const playbackState: RoomPlaybackState =
        controller?.playbackState ?? own[0]?.playbackState ?? "idle"
      return {
        id: participant.id,
        kind: participant.kind,
        displayName:
          participant.kind === "guest"
            ? (participant.displayName ?? "Guest")
            : (userDisplayName(participant.userId ? account : null) ??
              "Deleted user"),
        username: participant.kind === "account" ? account.username : null,
        image: participant.kind === "account" ? account.image : null,
        isHost:
          participant.userId !== null &&
          participant.userId === roomRow.hostUserId,
        online: own.length > 0,
        playbackState,
        guestExpiresAt: participant.guestExpiresAt?.getTime() ?? null,
      }
    }
  )
  const names = new Map(
    members.map((member) => [member.id, member.displayName])
  )

  const pickRows = await ex
    .select({
      pick: roomPick,
      anime: animeMetadata,
      votes: sql<number>`count(${roomVote.participantId})::int`,
      mine: sql<boolean>`coalesce(bool_or(${roomVote.participantId} = ${context.participant.id}), false)`,
    })
    .from(roomPick)
    .innerJoin(animeMetadata, eq(animeMetadata.malId, roomPick.malId))
    .leftJoin(roomVote, eq(roomVote.pickId, roomPick.id))
    .where(eq(roomPick.roomId, roomRow.id))
    .groupBy(roomPick.id, animeMetadata.malId)
    .orderBy(asc(roomPick.createdAt))

  const [selectedAnime] =
    roomRow.malId === null
      ? []
      : await ex
          .select()
          .from(animeMetadata)
          .where(eq(animeMetadata.malId, roomRow.malId))

  const host = members.find((member) => member.isHost) ?? null
  const hostRow =
    host === null && roomRow.hostUserId
      ? (
          await ex
            .select(userFields)
            .from(user)
            .where(eq(user.id, roomRow.hostUserId))
        )[0]
      : undefined
  const [aiPending] = await ex
    .select({ actorKey: aiGeneration.actorKey })
    .from(aiGeneration)
    .where(
      and(
        eq(aiGeneration.roomId, roomRow.id),
        eq(aiGeneration.status, "running"),
        isNull(aiGeneration.threadId)
      )
    )
  const ownConnections = connections.filter(
    (connection) => connection.participantId === context.participant.id
  )
  const hostAway =
    roomRow.hostAwaySince !== null &&
    now - roomRow.hostAwaySince.getTime() > hostGraceMs
  const canControlPlayback =
    roomRow.status === "open" &&
    (context.isHost || (roomRow.playbackControl === "everyone" && !hostAway))

  return {
    id: roomRow.id,
    name: roomRow.name,
    access: roomRow.access,
    playbackControl: roomRow.playbackControl,
    aiAccess: roomRow.aiAccess,
    status: roomRow.status,
    revision: roomRow.revision,
    hostName: host?.displayName ?? userDisplayName(hostRow ?? null),
    hostOnline: host?.online ?? false,
    hostAwaySince: roomRow.hostAwaySince?.getTime() ?? null,
    selection:
      selectedAnime &&
      roomRow.provider &&
      roomRow.episodeId &&
      roomRow.episodeNumber !== null &&
      roomRow.audio
        ? {
            anime: toAnime(selectedAnime),
            provider: roomRow.provider as RoomEpisodeSelection["provider"],
            episodeId: roomRow.episodeId,
            episodeNumber: roomRow.episodeNumber,
            audio: roomRow.audio,
            revision: roomRow.selectionRevision,
          }
        : null,
    playback: {
      playing: roomRow.playing,
      positionSeconds: roomRow.positionSeconds,
      positionAt: roomRow.positionAt.getTime(),
      rate: roomRow.rate,
    },
    members,
    picks: pickRows.map((row) => ({
      id: row.pick.id,
      anime: toAnime(row.anime),
      addedBy: row.pick.addedBy ? (names.get(row.pick.addedBy) ?? null) : null,
      votes: row.votes,
      votedByYou: row.mine,
      createdAt: row.pick.createdAt.getTime(),
    })),
    you: {
      participantId: context.participant.id,
      kind: context.participant.kind,
      isHost: context.isHost,
      canControlPlayback,
      canAskAi: canAskAi(roomRow.aiAccess, context.isHost, roomRow.status),
      shareTaste: context.participant.shareTaste,
      controller:
        connectionId !== null &&
        ownConnections.some(
          (connection) =>
            connection.tabId === connectionId && connection.controller
        ),
      guestExpiresAt: context.participant.guestExpiresAt?.getTime() ?? null,
    },
    closedAt: roomRow.closedAt?.getTime() ?? null,
    aiPendingBy: aiPending
      ? (names.get(aiPending.actorKey.replace(/^participant:/, "")) ??
        "Someone")
      : null,
    serverTime: now,
  }
}

export const canAskAi = (
  aiAccess: RoomAiAccess,
  isHost: boolean,
  status: "open" | "closed"
) =>
  status === "open" &&
  (aiAccess === "everyone" || (aiAccess === "host" && isHost))

const endReason = (context: ViewerContext | null): RoomEndReason => {
  if (!context) return "deleted"
  const state = context.facts.participant?.state
  if (context.status === "banned") return "banned"
  if (state === "removed") return "removed"
  if (state === "left") return "left"
  if (state === "expired") return "expired"
  return "access"
}

const summaryRows = (ex: KaiserExecutor, userId: string, now: number) =>
  ex
    .select({
      room,
      anime: animeMetadata,
      host: userFields,
      membership: roomParticipant.state,
      online: sql<number>`(select count(distinct ${roomConnection.participantId}) from ${roomConnection} where ${roomConnection.roomId} = ${room.id} and ${roomConnection.lastSeenAt} > ${liveCutoff(now)})::int`,
    })
    .from(room)
    .leftJoin(animeMetadata, eq(animeMetadata.malId, room.malId))
    .leftJoin(user, eq(user.id, room.hostUserId))
    .leftJoin(
      roomParticipant,
      and(
        eq(roomParticipant.roomId, room.id),
        eq(roomParticipant.userId, userId)
      )
    )

type SummaryRow = Awaited<
  ReturnType<ReturnType<typeof summaryRows>["where"]>
>[number]

const toSummary = (row: SummaryRow, userId: string): RoomSummary => ({
  id: row.room.id,
  name: row.room.name,
  access: row.room.access,
  status: row.room.status,
  hostName: userDisplayName(row.room.hostUserId ? row.host : null),
  anime: row.anime ? toAnime(row.anime) : null,
  episodeNumber: row.room.episodeNumber,
  onlineCount: row.online,
  capacity: RoomCapacity,
  isHost: row.room.hostUserId === userId,
  membership:
    row.membership === "admitted"
      ? "member"
      : row.membership === "invited"
        ? "invited"
        : "none",
  updatedAt: row.room.updatedAt.getTime(),
})

export class RoomService extends Context.Service<RoomService>()(
  "@animekaiser/core/RoomService",
  {
    make: Effect.gen(function* () {
      const database = yield* Database
      const events = yield* RoomEvents
      const runtimeId = crypto.randomUUID()
      const live = new Set<string>()

      const run = <T>(fn: (db: KaiserDb) => Promise<T>) =>
        database.execute(fn).pipe(
          Effect.catchFilter(
            thrownBy(Schema.is(RoomOperationError)),
            Effect.fail
          ),
          Effect.tapErrorTag("DatabaseError", (error) =>
            Effect.logError("[Rooms] Database operation failed", error)
          ),
          Effect.catchTag("DatabaseError", () =>
            Effect.fail(fail("failed", "Something went wrong. Try again."))
          )
        )

      const transact = <T>(fn: (tx: KaiserExecutor) => Promise<T>) =>
        run((db) => db.transaction((tx) => fn(tx)))

      const create = Effect.fn("RoomService.create")(function* (
        hostUserId: string,
        input: {
          roomId: string
          name: string
          access: RoomAccess
          playbackControl: RoomPlaybackControl
          aiAccess: RoomAiAccess
          selection: (RoomEpisodeSelection & { positionSeconds: number }) | null
        }
      ) {
        const now = yield* Clock.currentTimeMillis
        return yield* transact(async (tx) => {
          const [existing] = await tx
            .select({ hostUserId: room.hostUserId })
            .from(room)
            .where(eq(room.id, input.roomId))
          if (existing) {
            if (existing.hostUserId !== hostUserId)
              throw fail("invalid", "Unable to create this room.")
            return { roomId: input.roomId }
          }
          const [recent] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(room)
            .where(
              and(
                eq(room.hostUserId, hostUserId),
                gt(room.createdAt, new Date(now - 60 * 60 * 1000))
              )
            )
          if ((recent?.count ?? 0) >= 10)
            throw fail(
              "rate_limited",
              "You've created a lot of rooms. Try again later."
            )
          const selection = input.selection
          if (selection) await upsertAnime(tx, selection.anime)
          await tx.insert(room).values({
            id: input.roomId,
            name: input.name,
            hostUserId,
            access: input.access,
            playbackControl: input.playbackControl,
            aiAccess: input.aiAccess,
            malId: selection?.anime.malId ?? null,
            provider: selection?.provider ?? null,
            episodeId: selection?.episodeId ?? null,
            episodeNumber: selection?.episodeNumber ?? null,
            audio: selection?.audio ?? null,
            selectionRevision: selection ? 1 : 0,
            positionSeconds: selection?.positionSeconds ?? 0,
            positionAt: new Date(now),
            hostAwaySince: new Date(now),
          })
          await tx.insert(roomParticipant).values({
            roomId: input.roomId,
            kind: "account",
            userId: hostUserId,
            state: "admitted",
            admittedAt: new Date(now),
          })
          return { roomId: input.roomId }
        })
      })

      const list = Effect.fn("RoomService.list")(function* (
        userId: string,
        tab: RoomListTab
      ) {
        const now = yield* Clock.currentTimeMillis
        return yield* run(async (db) => {
          const base = summaryRows(db, userId, now)
          const rows = await (async () => {
            switch (tab) {
              case "mine":
                return base
                  .where(
                    and(
                      eq(roomParticipant.state, "admitted"),
                      or(
                        eq(room.status, "open"),
                        gt(room.closedAt, new Date(now - retentionMs))
                      )
                    )
                  )
                  .orderBy(desc(room.updatedAt))
                  .limit(50)
              case "invitations":
                return base
                  .where(
                    and(
                      eq(roomParticipant.state, "invited"),
                      eq(room.status, "open")
                    )
                  )
                  .orderBy(desc(roomParticipant.updatedAt))
                  .limit(50)
              case "friends": {
                const friends = await friendIdsOf(db, userId)
                if (friends.length === 0) return []
                return base
                  .where(
                    and(
                      eq(room.status, "open"),
                      inArray(room.hostUserId, friends),
                      or(eq(room.access, "friends"), eq(room.access, "public")),
                      or(
                        isNull(roomParticipant.state),
                        ne(roomParticipant.state, "banned")
                      )
                    )
                  )
                  .orderBy(desc(room.updatedAt))
                  .limit(50)
              }
              case "public":
                return base
                  .where(
                    and(
                      eq(room.status, "open"),
                      eq(room.access, "public"),
                      or(
                        isNull(roomParticipant.state),
                        ne(roomParticipant.state, "banned")
                      )
                    )
                  )
                  .orderBy(desc(room.updatedAt))
                  .limit(50)
            }
          })()
          return rows.map((row) => toSummary(row, userId))
        })
      })

      const admission = Effect.fn("RoomService.admission")(function* (
        actor: Actor,
        roomId: string,
        inviteToken: string | undefined
      ) {
        const now = yield* Clock.currentTimeMillis
        return yield* run(async (db): Promise<RoomAdmission> => {
          const context = await loadViewer(db, actor, roomId, now, {
            inviteToken,
          })
          if (!context)
            return { status: "unavailable", guestAllowed: false, room: null }
          const { status, facts } = context
          const revealed =
            status === "member" ||
            status === "joinable" ||
            status === "full" ||
            (status === "sign_in_required" &&
              (facts.access === "public" || facts.validLink))
          const guestAllowed =
            !facts.signedIn &&
            facts.validLink &&
            facts.access !== "friends" &&
            facts.roomOpen &&
            status !== "banned"
          if (!revealed)
            return {
              status: status === "closed" ? "closed" : status,
              guestAllowed: false,
              room: null,
            }
          const roomRow = context.room
          const [anime] =
            roomRow.malId === null
              ? []
              : await db
                  .select()
                  .from(animeMetadata)
                  .where(eq(animeMetadata.malId, roomRow.malId))
          const [host] = roomRow.hostUserId
            ? await db
                .select(userFields)
                .from(user)
                .where(eq(user.id, roomRow.hostUserId))
            : []
          return {
            status,
            guestAllowed,
            room: {
              id: roomRow.id,
              name: roomRow.name,
              access: roomRow.access,
              hostName: userDisplayName(host ?? null),
              anime: anime ? toAnime(anime) : null,
              episodeNumber: roomRow.episodeNumber,
              onlineCount: facts.onlineCount,
              capacity: RoomCapacity,
            },
          }
        })
      })

      const join = Effect.fn("RoomService.join")(function* (
        actor: Actor,
        roomId: string,
        inviteToken: string | undefined
      ) {
        const now = yield* Clock.currentTimeMillis
        const account = actor.user
        if (!account)
          return yield* fail("sign_in_required", "Sign in to join this room.")
        yield* transact(async (tx) => {
          const context = await loadViewer(tx, actor, roomId, now, {
            inviteToken,
            lock: true,
          })
          if (!context) throw fail("unavailable", "This room is unavailable.")
          if (context.status === "member") return
          if (context.status !== "joinable")
            throw fail(
              admissionError(context.status).reason,
              admissionError(context.status).message
            )
          const existing =
            context.participant?.kind === "account" ? context.participant : null
          if (existing) {
            await tx
              .update(roomParticipant)
              .set({ state: "admitted", admittedAt: new Date(now) })
              .where(eq(roomParticipant.id, existing.id))
          } else {
            await tx.insert(roomParticipant).values({
              roomId,
              kind: "account",
              userId: account.id,
              state: "admitted",
              admittedAt: new Date(now),
            })
          }
          const [joined] = await tx
            .select()
            .from(roomParticipant)
            .where(
              and(
                eq(roomParticipant.roomId, roomId),
                eq(roomParticipant.userId, account.id)
              )
            )
          if (joined)
            await systemMessage(
              tx,
              roomId,
              `${await participantName(tx, joined)} joined`
            )
          await tx.update(room).set(bumpRevision).where(eq(room.id, roomId))
          await tx.execute(notifyRoom(roomId))
        })
      })

      const admitGuest = Effect.fn("RoomService.admitGuest")(function* (
        roomId: string,
        inviteToken: string,
        displayName: string
      ) {
        const now = yield* Clock.currentTimeMillis
        const token = createOpaqueToken()
        const expiresAt = new Date(now + guestSessionMs)
        yield* transact(async (tx) => {
          const context = await loadViewer(
            tx,
            {
              user: null,
              guestTokens: [],
              sessionActive: Effect.succeed(true),
            },
            roomId,
            now,
            { inviteToken, lock: true }
          )
          if (!context) throw fail("unavailable", "This room is unavailable.")
          if (
            context.status !== "joinable" ||
            context.room.access === "friends"
          )
            throw fail(
              admissionError(context.status).reason,
              admissionError(context.status).message
            )
          await tx.insert(roomParticipant).values({
            roomId,
            kind: "guest",
            guestTokenHash: hashToken(token),
            guestExpiresAt: expiresAt,
            displayName,
            state: "admitted",
            admittedAt: new Date(now),
          })
          await systemMessage(tx, roomId, `${displayName} joined as a guest`)
          await tx.update(room).set(bumpRevision).where(eq(room.id, roomId))
          await tx.execute(notifyRoom(roomId))
        })
        return { token, expiresAt }
      })

      const convertGuest = Effect.fn("RoomService.convertGuest")(function* (
        actor: Actor,
        roomId: string
      ) {
        const account = actor.user
        if (!account)
          return yield* fail("sign_in_required", "Sign in to keep this room.")
        const admittedAt = DateTime.toDateUtc(yield* DateTime.now)
        yield* transact(async (tx) => {
          // Room before thread, matching AI publication's lock order.
          await tx
            .select({ id: room.id })
            .from(room)
            .where(eq(room.id, roomId))
            .for("update")
          const { account: existing, guest } = await findParticipants(
            tx,
            actor,
            roomId
          )
          if (!guest) return
          if (existing) {
            await tx
              .update(roomMessage)
              .set({ participantId: existing.id })
              .where(eq(roomMessage.participantId, guest.id))
            await tx
              .update(roomPick)
              .set({ addedBy: existing.id })
              .where(eq(roomPick.addedBy, guest.id))
            await tx.execute(
              sql`insert into ${roomVote} (pick_id, participant_id, created_at)
                  select pick_id, ${existing.id}, created_at from ${roomVote}
                  where participant_id = ${guest.id}
                  on conflict do nothing`
            )
            await tx
              .update(recommendationThread)
              .set({
                ownerUserId: account.id,
                guestParticipantId: null,
                roomId: null,
              })
              .where(eq(recommendationThread.guestParticipantId, guest.id))
            await tx
              .delete(roomParticipant)
              .where(eq(roomParticipant.id, guest.id))
            if (existing.state !== "admitted" && existing.state !== "banned")
              await tx
                .update(roomParticipant)
                .set({ state: "admitted", admittedAt })
                .where(eq(roomParticipant.id, existing.id))
          } else {
            await tx
              .update(recommendationThread)
              .set({
                ownerUserId: account.id,
                guestParticipantId: null,
                roomId: null,
              })
              .where(eq(recommendationThread.guestParticipantId, guest.id))
            await tx
              .update(roomParticipant)
              .set({
                kind: "account",
                userId: account.id,
                guestTokenHash: null,
                guestExpiresAt: null,
                displayName: null,
              })
              .where(eq(roomParticipant.id, guest.id))
          }
          await tx.update(room).set(bumpRevision).where(eq(room.id, roomId))
          await tx.execute(notifyRoom(roomId))
        })
      })

      const disconnect = (streamId: string) =>
        DateTime.now.pipe(
          Effect.map(DateTime.toDateUtc),
          Effect.flatMap((now) =>
            transact(async (tx) => {
              const [connection] = await tx
                .delete(roomConnection)
                .where(eq(roomConnection.id, streamId))
                .returning()
              if (!connection) return
              if (connection.controller) {
                const remaining = await tx
                  .select({
                    id: roomConnection.id,
                    tabId: roomConnection.tabId,
                  })
                  .from(roomConnection)
                  .where(
                    eq(roomConnection.participantId, connection.participantId)
                  )
                  .orderBy(asc(roomConnection.connectedAt))
                const sameTab = remaining.some(
                  (row) => row.tabId === connection.tabId
                )
                const next = remaining[0]
                if (!sameTab && next)
                  await tx
                    .update(roomConnection)
                    .set({ controller: true })
                    .where(eq(roomConnection.tabId, next.tabId))
              }
              await markHostAwayIfGone(tx, [connection.roomId], now)
              await tx.execute(notifyRoom(connection.roomId))
            })
          ),
          Effect.ensuring(Effect.sync(() => live.delete(streamId)))
        )

      const markHostAwayIfGone = (
        ex: KaiserExecutor,
        roomIds: ReadonlyArray<string>,
        now: Date
      ) =>
        roomIds.length === 0
          ? Promise.resolve()
          : ex.execute(sql`
              update ${room} set host_away_since = ${now}
              where ${room.id} in ${roomIds}
                and ${room.hostAwaySince} is null
                and not exists (
                  select 1 from ${roomConnection} c
                  join ${roomParticipant} p on p.id = c.participant_id
                  where c.room_id = ${room.id} and p.user_id = ${room.hostUserId}
                )`)

      const watch = (actor: Actor, roomId: string, connectionId: string) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const signals = yield* events.subscribe(roomId)
            const streamId = crypto.randomUUID()
            const connectedAt = yield* Clock.currentTimeMillis
            yield* transact(async (tx) => {
              const context = await requireMember(
                tx,
                actor,
                roomId,
                connectedAt,
                {
                  lock: true,
                }
              )
              const online = await onlineParticipants(tx, roomId, connectedAt)
              online.delete(context.participant.id)
              if (online.size >= RoomCapacity)
                throw fail("full", "This room is full.")
              const controllers = await tx
                .select({ tabId: roomConnection.tabId })
                .from(roomConnection)
                .where(
                  and(
                    eq(roomConnection.participantId, context.participant.id),
                    eq(roomConnection.controller, true)
                  )
                )
              await tx.insert(roomConnection).values({
                id: streamId,
                tabId: connectionId,
                roomId,
                participantId: context.participant.id,
                runtimeId,
                controller:
                  controllers.length === 0 ||
                  controllers.some((row) => row.tabId === connectionId),
              })
              await tx
                .update(roomParticipant)
                .set({ lastSeenAt: new Date(connectedAt) })
                .where(eq(roomParticipant.id, context.participant.id))
              await tx
                .update(room)
                .set({
                  lastConnectedAt: new Date(connectedAt),
                  ...(context.isHost ? { hostAwaySince: null } : {}),
                })
                .where(eq(room.id, roomId))
              await tx.execute(notifyRoom(roomId))
            })
            live.add(streamId)
            yield* Effect.addFinalizer(() =>
              disconnect(streamId).pipe(Effect.ignore)
            )

            type Accumulator = {
              lastSeq: number | null
              lastState: string | null
              lastReloadAt: number
              sessionCheckedAt: number
            }

            const reload = (
              acc: Accumulator
            ): Effect.Effect<
              readonly [Accumulator, ReadonlyArray<RoomEvent>],
              RoomOperationError
            > =>
              Effect.gen(function* () {
                const now = yield* Clock.currentTimeMillis
                let sessionCheckedAt = acc.sessionCheckedAt
                if (actor.user && now - sessionCheckedAt > 60_000) {
                  if (!(yield* actor.sessionActive))
                    return [
                      acc,
                      [{ _tag: "Ended", reason: "signed_out" }],
                    ] as const
                  sessionCheckedAt = now
                }
                return yield* run(async (db) => {
                  const context = await loadViewer(db, actor, roomId, now)
                  if (context?.status !== "member" || !context.participant)
                    return [
                      acc,
                      [{ _tag: "Ended", reason: endReason(context) } as const],
                    ] as const
                  const state = await loadState(
                    db,
                    { ...context, participant: context.participant },
                    connectionId,
                    now
                  )
                  const output: Array<RoomEvent> = []
                  const fingerprint = JSON.stringify({
                    ...state,
                    serverTime: 0,
                  })
                  if (fingerprint !== acc.lastState)
                    output.push({ _tag: "State", state })
                  let lastSeq = acc.lastSeq
                  if (lastSeq === null) {
                    const page = await latestMessages(db, roomId, null)
                    output.push({ _tag: "Messages", ...page })
                    lastSeq = page.messages.at(-1)?.seq ?? 0
                  } else {
                    const rows = await selectMessages(db)
                      .where(
                        and(
                          eq(roomMessage.roomId, roomId),
                          or(
                            gt(roomMessage.seq, lastSeq),
                            gt(
                              roomMessage.deletedAt,
                              new Date(acc.lastReloadAt - 1000)
                            )
                          )
                        )
                      )
                      .orderBy(asc(roomMessage.seq))
                      .limit(200)
                    if (rows.length > 0) {
                      const messages = rows.map(toMessage)
                      output.push({
                        _tag: "Messages",
                        messages,
                        hasEarlier: false,
                      })
                      lastSeq = Math.max(lastSeq, ...messages.map((m) => m.seq))
                    }
                  }
                  return [
                    {
                      lastSeq,
                      lastState: fingerprint,
                      lastReloadAt: connectedAt,
                      sessionCheckedAt,
                    },
                    output,
                  ] as const
                })
              })

            const triggers = Stream.concat(
              Stream.succeed(undefined),
              Stream.merge(signals, Stream.tick("10 seconds")).pipe(
                Stream.groupedWithin(64, "40 millis")
              )
            )

            return triggers.pipe(
              Stream.mapAccumEffect(
                (): Accumulator => ({
                  lastSeq: null,
                  lastState: null,
                  lastReloadAt: connectedAt,
                  sessionCheckedAt: connectedAt,
                }),
                (acc) => reload(acc)
              ),
              Stream.takeUntil((event) => event._tag === "Ended")
            )
          })
        )

      const listMessages = Effect.fn("RoomService.listMessages")(function* (
        actor: Actor,
        roomId: string,
        beforeSeq: number
      ) {
        const now = yield* Clock.currentTimeMillis
        return yield* run(async (db) => {
          await requireMember(db, actor, roomId, now)
          return latestMessages(db, roomId, beforeSeq)
        })
      })

      const sendMessage = Effect.fn("RoomService.sendMessage")(function* (
        actor: Actor,
        roomId: string,
        requestId: string,
        body: string
      ) {
        const now = yield* Clock.currentTimeMillis
        const text = body.trim()
        if (text.length === 0)
          return yield* fail("invalid", "Write a message first.")
        return yield* transact(async (tx) => {
          const context = await requireMember(tx, actor, roomId, now, {
            open: true,
          })
          const [recent] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(roomMessage)
            .where(
              and(
                eq(roomMessage.roomId, roomId),
                eq(roomMessage.participantId, context.participant.id),
                gt(roomMessage.createdAt, new Date(now - 10_000))
              )
            )
          if ((recent?.count ?? 0) >= 8)
            throw fail("rate_limited", "You're sending messages too quickly.")
          const message = await insertMessage(tx, {
            roomId,
            participantId: context.participant.id,
            kind: "text",
            body: text,
            requestId,
          })
          await tx.execute(notifyRoom(roomId))
          const [row] = await selectMessages(tx).where(
            eq(roomMessage.id, message.id)
          )
          if (!row) throw fail("failed", "Unable to send the message.")
          return toMessage(row)
        })
      })

      const deleteMessage = Effect.fn("RoomService.deleteMessage")(function* (
        actor: Actor,
        roomId: string,
        messageId: string
      ) {
        const now = yield* Clock.currentTimeMillis
        yield* transact(async (tx) => {
          const context = await requireMember(tx, actor, roomId, now, {
            open: true,
          })
          const [message] = await tx
            .select()
            .from(roomMessage)
            .where(
              and(eq(roomMessage.id, messageId), eq(roomMessage.roomId, roomId))
            )
          if (!message) return
          if (
            !context.isHost &&
            message.participantId !== context.participant.id
          )
            throw fail("not_host", "Only the host can remove other messages.")
          await tx
            .update(roomMessage)
            .set({ deletedAt: new Date(now) })
            .where(eq(roomMessage.id, messageId))
          await tx.execute(notifyRoom(roomId))
        })
      })

      const command = Effect.fn("RoomService.command")(function* (
        actor: Actor,
        roomId: string,
        selectionRevision: number,
        action: RoomPlaybackAction
      ) {
        const now = yield* Clock.currentTimeMillis
        yield* transact(async (tx) => {
          const context = await requireMember(tx, actor, roomId, now, {
            lock: true,
            open: true,
          })
          const roomRow = context.room
          if (!context.isHost) {
            if (roomRow.playbackControl !== "everyone")
              throw fail("cannot_control", "The host controls playback.")
            if (
              roomRow.hostAwaySince &&
              now - roomRow.hostAwaySince.getTime() > hostGraceMs
            )
              throw fail(
                "host_away",
                "Playback is paused until the host returns."
              )
          }
          if (roomRow.malId === null)
            throw fail("invalid", "Choose an episode first.")
          if (roomRow.selectionRevision !== selectionRevision)
            throw fail(
              "stale",
              "The episode changed. Your player is catching up."
            )
          const current = {
            playing: roomRow.playing,
            positionSeconds: roomRow.positionSeconds,
            positionAt: roomRow.positionAt.getTime(),
            rate: roomRow.rate,
          }
          const next = (() => {
            switch (action._tag) {
              case "Play":
                return {
                  playing: true,
                  positionSeconds: action.positionSeconds,
                }
              case "Pause":
                return {
                  playing: false,
                  positionSeconds: action.positionSeconds,
                }
              case "Seek":
                return {
                  playing: current.playing,
                  positionSeconds: action.positionSeconds,
                }
              case "Rate":
                return {
                  playing: current.playing,
                  positionSeconds: action.positionSeconds,
                  rate: action.rate,
                }
            }
          })()
          await tx
            .update(room)
            .set({ ...next, positionAt: new Date(now), ...bumpRevision })
            .where(eq(room.id, roomId))
          await tx.execute(notifyRoom(roomId))
        })
      })

      const selectEpisode = Effect.fn("RoomService.selectEpisode")(function* (
        actor: Actor,
        roomId: string,
        selection: RoomEpisodeSelection | null,
        play = false
      ) {
        const now = yield* Clock.currentTimeMillis
        yield* transact(async (tx) => {
          await requireHost(tx, actor, roomId, now)
          if (selection) await upsertAnime(tx, selection.anime)
          await tx
            .update(room)
            .set({
              malId: selection?.anime.malId ?? null,
              provider: selection?.provider ?? null,
              episodeId: selection?.episodeId ?? null,
              episodeNumber: selection?.episodeNumber ?? null,
              audio: selection?.audio ?? null,
              selectionRevision: sql`${room.selectionRevision} + 1`,
              playing: selection !== null && play,
              positionSeconds: 0,
              positionAt: new Date(now),
              rate: 1,
              ...bumpRevision,
            })
            .where(eq(room.id, roomId))
          await systemMessage(
            tx,
            roomId,
            selection
              ? `Now watching ${animeTitle(selection.anime)} · Episode ${selection.episodeNumber}`
              : "The host is choosing what to watch next",
            selection
              ? { type: "selection", malId: selection.anime.malId }
              : { type: "choosing" }
          )
          await tx.execute(notifyRoom(roomId))
        })
      })

      const claimPlayback = Effect.fn("RoomService.claimPlayback")(function* (
        actor: Actor,
        roomId: string,
        connectionId: string
      ) {
        const now = yield* Clock.currentTimeMillis
        yield* transact(async (tx) => {
          const context = await requireMember(tx, actor, roomId, now)
          const [connection] = await tx
            .select()
            .from(roomConnection)
            .where(
              and(
                eq(roomConnection.tabId, connectionId),
                eq(roomConnection.participantId, context.participant.id)
              )
            )
          if (!connection)
            throw fail("invalid", "Reconnect to the room and try again.")
          await tx
            .update(roomConnection)
            .set({
              controller: sql`${roomConnection.tabId} = ${connectionId}`,
            })
            .where(eq(roomConnection.participantId, context.participant.id))
          await tx.execute(notifyRoom(roomId))
        })
      })

      const reportPlaybackState = Effect.fn("RoomService.reportPlaybackState")(
        function* (
          actor: Actor,
          roomId: string,
          connectionId: string,
          state: RoomPlaybackState
        ) {
          const now = yield* Clock.currentTimeMillis
          yield* transact(async (tx) => {
            const context = await requireMember(tx, actor, roomId, now)
            const updated = await tx
              .update(roomConnection)
              .set({ playbackState: state })
              .where(
                and(
                  eq(roomConnection.tabId, connectionId),
                  eq(roomConnection.participantId, context.participant.id),
                  ne(roomConnection.playbackState, state)
                )
              )
              .returning({ id: roomConnection.id })
            if (updated.length > 0) await tx.execute(notifyRoom(roomId))
          })
        }
      )

      const ineligibleForAccess = async (
        ex: KaiserExecutor,
        roomRow: RoomRow,
        access: RoomAccess
      ) => {
        if (access !== "friends") return []
        const friends = roomRow.hostUserId
          ? new Set(await friendIdsOf(ex, roomRow.hostUserId))
          : new Set<string>()
        const rows = await ex
          .select({ participant: roomParticipant, ...userFields })
          .from(roomParticipant)
          .leftJoin(user, eq(user.id, roomParticipant.userId))
          .where(
            and(
              eq(roomParticipant.roomId, roomRow.id),
              inArray(roomParticipant.state, ["admitted", "invited"])
            )
          )
        return rows
          .filter(
            ({ participant }) =>
              participant.userId !== roomRow.hostUserId &&
              (participant.kind === "guest" ||
                participant.userId === null ||
                !friends.has(participant.userId))
          )
          .map(({ participant, ...account }) => ({
            id: participant.id,
            name:
              participant.kind === "guest"
                ? (participant.displayName ?? "Guest")
                : (userDisplayName(account) ?? "Deleted user"),
          }))
      }

      const previewAccessChange = Effect.fn("RoomService.previewAccessChange")(
        function* (actor: Actor, roomId: string, access: RoomAccess) {
          const now = yield* Clock.currentTimeMillis
          return yield* run(async (db) => {
            const context = await requireHost(db, actor, roomId, now, {
              lock: false,
            })
            const current = context.room.access
            return {
              removed: await ineligibleForAccess(db, context.room, access),
              broadens: access !== current && current !== "public",
            }
          })
        }
      )

      const updateSettings = Effect.fn("RoomService.updateSettings")(function* (
        actor: Actor,
        roomId: string,
        input: {
          name?: string
          access?: RoomAccess
          playbackControl?: RoomPlaybackControl
          aiAccess?: RoomAiAccess
        }
      ) {
        const now = yield* Clock.currentTimeMillis
        yield* transact(async (tx) => {
          const context = await requireHost(tx, actor, roomId, now)
          if (input.access && input.access !== context.room.access) {
            const removed = await ineligibleForAccess(
              tx,
              context.room,
              input.access
            )
            if (removed.length > 0) {
              await tx
                .update(roomParticipant)
                .set({ state: "removed" })
                .where(
                  inArray(
                    roomParticipant.id,
                    removed.map((entry) => entry.id)
                  )
                )
              await tx.delete(roomConnection).where(
                inArray(
                  roomConnection.participantId,
                  removed.map((entry) => entry.id)
                )
              )
            }
            const label = {
              public: "Public",
              friends: "Friends only",
              invite: "Invite only",
            }[input.access]
            await systemMessage(tx, roomId, `Room access changed to ${label}`)
          }
          if (input.aiAccess && input.aiAccess !== context.room.aiAccess)
            await systemMessage(
              tx,
              roomId,
              {
                off: "Room AI turned off",
                host: "Only the host can ask AI",
                everyone: "Everyone can ask AI",
              }[input.aiAccess]
            )
          if (
            input.playbackControl &&
            input.playbackControl !== context.room.playbackControl
          )
            await systemMessage(
              tx,
              roomId,
              input.playbackControl === "everyone"
                ? "Everyone can control playback"
                : "Only the host controls playback"
            )
          await tx
            .update(room)
            .set({ ...input, ...bumpRevision })
            .where(eq(room.id, roomId))
          await tx.execute(notifyRoom(roomId))
        })
      })

      const createInviteLink = Effect.fn("RoomService.createInviteLink")(
        function* (actor: Actor, roomId: string) {
          const now = yield* Clock.currentTimeMillis
          const token = createOpaqueToken()
          const expiresAt = new Date(now + inviteLinkMs)
          yield* transact(async (tx) => {
            const context = await requireHost(tx, actor, roomId, now)
            const [active] = await tx
              .select({ count: sql<number>`count(*)::int` })
              .from(roomInviteLink)
              .where(
                and(
                  eq(roomInviteLink.roomId, roomId),
                  isNull(roomInviteLink.revokedAt),
                  gt(roomInviteLink.expiresAt, new Date(now))
                )
              )
            if ((active?.count ?? 0) >= maxActiveLinks)
              throw fail(
                "rate_limited",
                "Revoke old invite links before creating more."
              )
            await tx.insert(roomInviteLink).values({
              roomId,
              tokenHash: hashToken(token),
              createdBy: context.room.hostUserId,
              expiresAt,
            })
          })
          return { token, expiresAt: expiresAt.getTime() }
        }
      )

      const revokeInviteLinks = Effect.fn("RoomService.revokeInviteLinks")(
        function* (actor: Actor, roomId: string) {
          const now = yield* Clock.currentTimeMillis
          yield* transact(async (tx) => {
            await requireHost(tx, actor, roomId, now)
            await tx
              .update(roomInviteLink)
              .set({ revokedAt: new Date(now) })
              .where(
                and(
                  eq(roomInviteLink.roomId, roomId),
                  isNull(roomInviteLink.revokedAt)
                )
              )
          })
        }
      )

      const invite = Effect.fn("RoomService.invite")(function* (
        actor: Actor,
        roomId: string,
        userIds: ReadonlyArray<string>
      ) {
        const now = yield* Clock.currentTimeMillis
        yield* transact(async (tx) => {
          const context = await requireHost(tx, actor, roomId, now)
          const hostId = context.room.hostUserId
          if (!hostId) throw fail("not_host", "Only the host can invite.")
          const friends = new Set(await friendIdsOf(tx, hostId))
          const targets = [...new Set(userIds)].filter((id) => friends.has(id))
          for (const userId of targets) {
            await tx
              .insert(roomParticipant)
              .values({
                roomId,
                kind: "account",
                userId,
                state: "invited",
                invitedBy: hostId,
              })
              .onConflictDoUpdate({
                target: [roomParticipant.roomId, roomParticipant.userId],
                targetWhere: isNotNull(roomParticipant.userId),
                set: {
                  state: sql`case when ${roomParticipant.state} in ('admitted', 'banned') then ${roomParticipant.state} else 'invited' end`,
                  invitedBy: hostId,
                },
              })
          }
          await tx.execute(notifyRoom(roomId))
        })
      })

      const declineInvitation = Effect.fn("RoomService.declineInvitation")(
        function* (userId: string, roomId: string) {
          yield* transact(async (tx) => {
            await tx
              .delete(roomParticipant)
              .where(
                and(
                  eq(roomParticipant.roomId, roomId),
                  eq(roomParticipant.userId, userId),
                  eq(roomParticipant.state, "invited")
                )
              )
          })
        }
      )

      const removeParticipant = Effect.fn("RoomService.removeParticipant")(
        function* (
          actor: Actor,
          roomId: string,
          participantId: string,
          ban: boolean
        ) {
          const now = yield* Clock.currentTimeMillis
          yield* transact(async (tx) => {
            const context = await requireHost(tx, actor, roomId, now)
            const [target] = await tx
              .select()
              .from(roomParticipant)
              .where(
                and(
                  eq(roomParticipant.id, participantId),
                  eq(roomParticipant.roomId, roomId)
                )
              )
            if (!target || target.id === context.participant.id)
              throw fail("invalid", "That member can't be removed.")
            await tx
              .update(roomParticipant)
              .set({ state: ban ? "banned" : "removed" })
              .where(eq(roomParticipant.id, participantId))
            await tx
              .delete(roomConnection)
              .where(eq(roomConnection.participantId, participantId))
            const name = await participantName(tx, target)
            await systemMessage(
              tx,
              roomId,
              ban ? `${name} was banned` : `${name} was removed`
            )
            await tx.update(room).set(bumpRevision).where(eq(room.id, roomId))
            await tx.execute(notifyRoom(roomId))
          })
        }
      )

      const transferHost = Effect.fn("RoomService.transferHost")(function* (
        actor: Actor,
        roomId: string,
        participantId: string
      ) {
        const now = yield* Clock.currentTimeMillis
        yield* transact(async (tx) => {
          const context = await requireHost(tx, actor, roomId, now)
          const [target] = await tx
            .select()
            .from(roomParticipant)
            .where(
              and(
                eq(roomParticipant.id, participantId),
                eq(roomParticipant.roomId, roomId),
                eq(roomParticipant.state, "admitted"),
                eq(roomParticipant.kind, "account")
              )
            )
          const online = await onlineParticipants(tx, roomId, now)
          if (!target?.userId || !online.has(target.id))
            throw fail(
              "invalid",
              "Hosting can only move to a signed-in member who is here now."
            )
          if (
            context.room.access === "friends" &&
            !(await areFriends(
              tx,
              context.room.hostUserId ?? "",
              target.userId
            ))
          )
            throw fail("invalid", "That member can't host this room.")
          await tx
            .update(room)
            .set({
              hostUserId: target.userId,
              hostAwaySince: null,
              ...bumpRevision,
            })
            .where(eq(room.id, roomId))
          await systemMessage(
            tx,
            roomId,
            `${await participantName(tx, target)} is now the host`
          )
          await tx.execute(notifyRoom(roomId))
        })
      })

      const leave = Effect.fn("RoomService.leave")(function* (
        actor: Actor,
        roomId: string
      ) {
        const now = yield* Clock.currentTimeMillis
        yield* transact(async (tx) => {
          const context = await requireMember(tx, actor, roomId, now, {
            lock: true,
          })
          if (context.isHost && context.room.status === "open")
            throw fail(
              "host_must_transfer",
              "Transfer hosting or close the room before leaving."
            )
          await tx
            .update(roomParticipant)
            .set({ state: "left" })
            .where(eq(roomParticipant.id, context.participant.id))
          await tx
            .delete(roomConnection)
            .where(eq(roomConnection.participantId, context.participant.id))
          if (context.room.status === "open")
            await systemMessage(
              tx,
              roomId,
              `${await participantName(tx, context.participant)} left`
            )
          await tx.update(room).set(bumpRevision).where(eq(room.id, roomId))
          await tx.execute(notifyRoom(roomId))
        })
      })

      const close = Effect.fn("RoomService.close")(function* (
        actor: Actor,
        roomId: string,
        remove: boolean
      ) {
        const now = yield* Clock.currentTimeMillis
        yield* transact(async (tx) => {
          const context = await requireMember(tx, actor, roomId, now, {
            lock: true,
          })
          if (!context.isHost)
            throw fail("not_host", "Only the host can close this room.")
          if (remove) {
            await tx.execute(notifyRoom(roomId))
            await tx.delete(room).where(eq(room.id, roomId))
            return
          }
          if (context.room.status === "closed") return
          await tx
            .update(room)
            .set({
              status: "closed",
              closedAt: new Date(now),
              playing: false,
              positionSeconds: projectPosition(
                {
                  playing: context.room.playing,
                  positionSeconds: context.room.positionSeconds,
                  positionAt: context.room.positionAt.getTime(),
                  rate: context.room.rate,
                },
                now
              ),
              positionAt: new Date(now),
              ...bumpRevision,
            })
            .where(eq(room.id, roomId))
          await tx
            .update(roomInviteLink)
            .set({ revokedAt: new Date(now) })
            .where(
              and(
                eq(roomInviteLink.roomId, roomId),
                isNull(roomInviteLink.revokedAt)
              )
            )
          await systemMessage(tx, roomId, "The host closed the room")
          await tx.execute(notifyRoom(roomId))
        })
      })

      const addPick = Effect.fn("RoomService.addPick")(function* (
        actor: Actor,
        roomId: string,
        anime: AnimeLibraryMetadata
      ) {
        const now = yield* Clock.currentTimeMillis
        yield* transact(async (tx) => {
          const context = await requireMember(tx, actor, roomId, now, {
            open: true,
          })
          const [picks] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(roomPick)
            .where(eq(roomPick.roomId, roomId))
          if ((picks?.count ?? 0) >= maxPicks)
            throw fail("invalid", "The shortlist is full.")
          await upsertAnime(tx, anime)
          const inserted = await tx
            .insert(roomPick)
            .values({
              roomId,
              malId: anime.malId,
              addedBy: context.participant.id,
            })
            .onConflictDoNothing()
            .returning({ id: roomPick.id })
          if (inserted.length === 0) return
          await systemMessage(
            tx,
            roomId,
            `${await participantName(tx, context.participant)} suggested ${animeTitle(anime)}`,
            { type: "pick", malId: anime.malId }
          )
          await tx.execute(notifyRoom(roomId))
        })
      })

      const removePick = Effect.fn("RoomService.removePick")(function* (
        actor: Actor,
        roomId: string,
        pickId: string
      ) {
        const now = yield* Clock.currentTimeMillis
        yield* transact(async (tx) => {
          await requireHost(tx, actor, roomId, now, { lock: false })
          await tx
            .delete(roomPick)
            .where(and(eq(roomPick.id, pickId), eq(roomPick.roomId, roomId)))
          await tx.execute(notifyRoom(roomId))
        })
      })

      const vote = Effect.fn("RoomService.vote")(function* (
        actor: Actor,
        roomId: string,
        pickId: string,
        value: boolean
      ) {
        const now = yield* Clock.currentTimeMillis
        yield* transact(async (tx) => {
          const context = await requireMember(tx, actor, roomId, now, {
            open: true,
          })
          const [pick] = await tx
            .select({ id: roomPick.id })
            .from(roomPick)
            .where(and(eq(roomPick.id, pickId), eq(roomPick.roomId, roomId)))
          if (!pick) throw fail("invalid", "That pick was removed.")
          if (value)
            await tx
              .insert(roomVote)
              .values({ pickId, participantId: context.participant.id })
              .onConflictDoNothing()
          else
            await tx
              .delete(roomVote)
              .where(
                and(
                  eq(roomVote.pickId, pickId),
                  eq(roomVote.participantId, context.participant.id)
                )
              )
          await tx.execute(notifyRoom(roomId))
        })
      })

      const setTasteSharing = Effect.fn("RoomService.setTasteSharing")(
        function* (userId: string, roomId: string, share: boolean) {
          yield* transact(async (tx) => {
            const updated = await tx
              .update(roomParticipant)
              .set({ shareTaste: share })
              .where(
                and(
                  eq(roomParticipant.roomId, roomId),
                  eq(roomParticipant.userId, userId),
                  eq(roomParticipant.state, "admitted")
                )
              )
              .returning({ id: roomParticipant.id })
            if (updated.length === 0)
              throw fail("not_member", "You are not a member of this room.")
            await tx.execute(notifyRoom(roomId))
          })
        }
      )

      const recordViewing = Effect.fn("RoomService.recordViewing")(function* (
        userId: string,
        input: {
          roomId: string
          anime: AnimeLibraryMetadata
          provider: string
          episodeId: string
          serverId: string | null
          serverName: string | null
          episode: number
          audio: "sub" | "dub"
          positionSeconds: number
          durationSeconds: number | null
          segment: {
            fromSeconds: number
            toSeconds: number
            elapsedMs: number
            rate: number
          } | null
        }
      ) {
        const now = yield* Clock.currentTimeMillis
        return yield* transact(async (tx) => {
          const [membership] = await tx
            .select({ room })
            .from(roomParticipant)
            .innerJoin(room, eq(room.id, roomParticipant.roomId))
            .where(
              and(
                eq(roomParticipant.roomId, input.roomId),
                eq(roomParticipant.userId, userId),
                eq(roomParticipant.state, "admitted")
              )
            )
          if (!membership)
            throw fail("not_member", "You are not a member of this room.")
          const roomRow = membership.room
          const matchesRoom =
            roomRow.malId === input.anime.malId &&
            roomRow.episodeId === input.episodeId
          await upsertAnime(tx, input.anime)
          const key = and(
            eq(watchCoverage.userId, userId),
            eq(watchCoverage.malId, input.anime.malId),
            eq(watchCoverage.episode, input.episode)
          )
          const [existing] = await tx
            .select()
            .from(watchCoverage)
            .where(key)
            .for("update")
          const durationSeconds =
            input.durationSeconds !== null
              ? Math.round(input.durationSeconds)
              : (existing?.durationSeconds ?? null)
          const segment =
            matchesRoom && input.segment
              ? acceptedSegment({
                  fromSeconds: input.segment.fromSeconds,
                  toSeconds: input.segment.toSeconds,
                  clientElapsedMs: input.segment.elapsedMs,
                  serverElapsedMs: existing
                    ? now - existing.updatedAt.getTime()
                    : null,
                  rate: roomRow.rate * 1.15,
                  durationSeconds,
                })
              : null
          const intervals = segment
            ? mergeIntervals(existing?.intervals ?? [], segment)
            : (existing?.intervals ?? [])
          const wasComplete = existing?.completedAt != null
          const completed =
            wasComplete || isCoverageComplete(intervals, durationSeconds)
          await tx
            .insert(watchCoverage)
            .values({
              userId,
              malId: input.anime.malId,
              episode: input.episode,
              intervals,
              durationSeconds,
              completedAt: completed ? new Date(now) : null,
            })
            .onConflictDoUpdate({
              target: [
                watchCoverage.userId,
                watchCoverage.malId,
                watchCoverage.episode,
              ],
              set: {
                intervals,
                durationSeconds,
                completedAt: wasComplete
                  ? existing?.completedAt
                  : completed
                    ? new Date(now)
                    : null,
                updatedAt: new Date(now),
              },
            })

          const [history] = await tx
            .select({ status: watchHistory.status })
            .from(watchHistory)
            .where(
              and(
                eq(watchHistory.userId, userId),
                eq(watchHistory.malId, input.anime.malId),
                eq(watchHistory.episode, input.episode)
              )
            )
          const status =
            completed || history?.status === "completed"
              ? "completed"
              : "watching"
          const position = Math.floor(input.positionSeconds)
          if (position >= 5 || completed) {
            const values = {
              provider: input.provider,
              episodeId: input.episodeId,
              serverId: input.serverId,
              serverName: input.serverName,
              audio: input.audio,
              positionSeconds: position,
              durationSeconds,
              status,
            } as const
            await tx
              .insert(watchHistory)
              .values({
                userId,
                malId: input.anime.malId,
                episode: input.episode,
                ...values,
              })
              .onConflictDoUpdate({
                target: [
                  watchHistory.userId,
                  watchHistory.malId,
                  watchHistory.episode,
                ],
                set: { ...values, updatedAt: new Date(now) },
              })
          }
          return {
            coveredSeconds: coveredSeconds(intervals),
            completed,
            newlyCompleted: completed && !wasComplete,
          }
        })
      })

      const refreshLeases = Effect.fn("RoomService.refreshLeases")(
        function* () {
          const ids = [...live.keys()]
          if (ids.length === 0) return
          const now = DateTime.toDateUtc(yield* DateTime.now)
          yield* transact(async (tx) => {
            const rows = await tx
              .update(roomConnection)
              .set({ lastSeenAt: now })
              .where(inArray(roomConnection.id, ids))
              .returning({ roomId: roomConnection.roomId })
            const roomIds = [...new Set(rows.map((row) => row.roomId))]
            if (roomIds.length > 0)
              await tx
                .update(room)
                .set({ lastConnectedAt: now })
                .where(inArray(room.id, roomIds))
          })
        }
      )

      const pausedAt = (at: Date | ReturnType<typeof sql>) =>
        sql`${room.positionSeconds} + greatest(0, extract(epoch from (${at} - ${room.positionAt}))) * ${room.rate}`

      const sweep = Effect.fn("RoomService.sweep")(function* () {
        const now = DateTime.toDateUtc(yield* DateTime.now)
        const touched = new Set<string>()
        yield* transact(async (tx) => {
          const stale = await tx
            .delete(roomConnection)
            .where(lt(roomConnection.lastSeenAt, liveCutoff(now.getTime())))
            .returning({ roomId: roomConnection.roomId })
          for (const row of stale) touched.add(row.roomId)
          await markHostAwayIfGone(tx, [...touched], now)

          const paused = await tx
            .update(room)
            .set({
              playing: false,
              positionSeconds: pausedAt(now),
              positionAt: now,
              ...bumpRevision,
            })
            .where(
              and(
                eq(room.status, "open"),
                eq(room.playing, true),
                lt(room.hostAwaySince, new Date(now.getTime() - hostGraceMs))
              )
            )
            .returning({ id: room.id })
          for (const row of paused) touched.add(row.id)

          const closed = await tx
            .update(room)
            .set({
              status: "closed",
              closedAt: now,
              playing: false,
              ...bumpRevision,
            })
            .where(
              and(
                eq(room.status, "open"),
                or(
                  isNull(room.hostUserId),
                  and(
                    lt(
                      room.lastConnectedAt,
                      new Date(now.getTime() - idleCloseMs)
                    ),
                    sql`not exists (select 1 from ${roomConnection} where ${roomConnection.roomId} = ${room.id})`
                  )
                )
              )
            )
            .returning({ id: room.id })
          for (const row of closed) touched.add(row.id)

          const expired = await tx
            .update(roomParticipant)
            .set({ state: "expired" })
            .where(
              and(
                eq(roomParticipant.kind, "guest"),
                eq(roomParticipant.state, "admitted"),
                lt(roomParticipant.guestExpiresAt, now)
              )
            )
            .returning({ roomId: roomParticipant.roomId })
          for (const row of expired) touched.add(row.roomId)

          await tx
            .delete(room)
            .where(
              and(
                eq(room.status, "closed"),
                lt(room.closedAt, new Date(now.getTime() - retentionMs))
              )
            )

          for (const roomId of touched) await tx.execute(notifyRoom(roomId))
        })
      })

      // Single API instance: connections owned by an earlier process are dead.
      // Playback pauses where it was when the old process last saw its members,
      // instead of advancing across the outage.
      const recoverAfterRestart = Effect.fn("RoomService.recoverAfterRestart")(
        function* () {
          const now = DateTime.toDateUtc(yield* DateTime.now)
          yield* transact(async (tx) => {
            await tx
              .delete(roomConnection)
              .where(ne(roomConnection.runtimeId, runtimeId))
            await tx
              .update(room)
              .set({
                playing: false,
                positionSeconds: pausedAt(
                  sql`least(${room.lastConnectedAt}, now())`
                ),
                positionAt: now,
                ...bumpRevision,
              })
              .where(and(eq(room.status, "open"), eq(room.playing, true)))
            await tx
              .update(room)
              .set({ hostAwaySince: now })
              .where(and(eq(room.status, "open"), isNull(room.hostAwaySince)))
          })
        }
      )

      return {
        create,
        list,
        admission,
        join,
        admitGuest,
        convertGuest,
        watch,
        listMessages,
        sendMessage,
        deleteMessage,
        command,
        selectEpisode,
        claimPlayback,
        reportPlaybackState,
        previewAccessChange,
        updateSettings,
        createInviteLink,
        revokeInviteLinks,
        invite,
        declineInvitation,
        removeParticipant,
        transferHost,
        leave,
        close,
        addPick,
        removePick,
        vote,
        setTasteSharing,
        recordViewing,
        refreshLeases,
        sweep,
        recoverAfterRestart,
        insertMessage: (input: Parameters<typeof insertMessage>[1]) =>
          transact(async (tx) => {
            const message = await insertMessage(tx, input)
            await tx.execute(notifyRoom(input.roomId))
            return message
          }),
      }
    }),
  }
) {
  static readonly layer = Layer.effect(RoomService, RoomService.make).pipe(
    Layer.provide(RoomEvents.layer)
  )
}
