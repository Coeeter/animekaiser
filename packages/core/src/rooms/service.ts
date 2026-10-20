import type { DatabaseError, KaiserExecutor } from "@animekaiser/db"
import {
  aiGeneration,
  animeMetadata,
  Database,
  friendship,
  query,
  recommendationThread,
  room,
  roomConnection,
  roomInviteLink,
  roomMessage,
  roomParticipant,
  roomPick,
  roomVote,
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

const upsertAnime = (anime: AnimeLibraryMetadata) =>
  query((db) =>
    db
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
  )

const animeTitle = (anime: AnimeLibraryMetadata) =>
  anime.title.english ?? anime.title.romaji

const liveCutoff = (now: number) => new Date(now - presenceTimeoutMs)

const areFriends = Effect.fnUntraced(function* (left: string, right: string) {
  if (left === right) return true
  const [low, high] = left < right ? [left, right] : [right, left]
  const rows = yield* query((db) =>
    db
      .select({ status: friendship.status })
      .from(friendship)
      .where(
        and(
          eq(friendship.userLowId, low),
          eq(friendship.userHighId, high),
          eq(friendship.status, "accepted")
        )
      )
  )
  return rows.length > 0
})

const friendIdsOf = (userId: string) =>
  query((db) =>
    db
      .select({ low: friendship.userLowId, high: friendship.userHighId })
      .from(friendship)
      .where(
        and(
          eq(friendship.status, "accepted"),
          or(
            eq(friendship.userLowId, userId),
            eq(friendship.userHighId, userId)
          )
        )
      )
  ).pipe(
    Effect.map((rows) =>
      rows.map((row) => (row.low === userId ? row.high : row.low))
    )
  )

const onlineParticipants = (roomId: string, now: number) =>
  query((db) =>
    db
      .selectDistinct({ participantId: roomConnection.participantId })
      .from(roomConnection)
      .where(
        and(
          eq(roomConnection.roomId, roomId),
          gt(roomConnection.lastSeenAt, liveCutoff(now))
        )
      )
  ).pipe(Effect.map((rows) => new Set(rows.map((row) => row.participantId))))

const validLink = Effect.fnUntraced(function* (
  roomId: string,
  token: string | undefined,
  now: number
) {
  if (!token) return false
  const rows = yield* query((db) =>
    db
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
  )
  return rows.length > 0
})

export const findParticipants = Effect.fnUntraced(function* (
  actor: Actor,
  roomId: string
) {
  const hashes = actor.guestTokens.map(hashToken)
  const conditions = [
    actor.user ? eq(roomParticipant.userId, actor.user.id) : undefined,
    hashes.length > 0
      ? inArray(roomParticipant.guestTokenHash, hashes)
      : undefined,
  ].filter((condition) => condition !== undefined)
  if (conditions.length === 0) return { account: null, guest: null }
  const rows = yield* query((db) =>
    db
      .select()
      .from(roomParticipant)
      .where(and(eq(roomParticipant.roomId, roomId), or(...conditions)))
  )
  return {
    account:
      rows.find((row) => actor.user !== null && row.userId === actor.user.id) ??
      null,
    guest: rows.find((row) => row.kind === "guest") ?? null,
  }
})

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

const findRoom = (roomId: string, lock = false) =>
  query(async (db) => {
    const select = db.select().from(room).where(eq(room.id, roomId))
    const [row] = lock ? await select.for("update") : await select
    return row ?? null
  })

const loadViewer = Effect.fnUntraced(function* (
  actor: Actor,
  roomId: string,
  now: number,
  options: { inviteToken?: string; lock?: boolean } = {}
) {
  const roomRow = yield* findRoom(roomId, options.lock)
  if (!roomRow) return null
  const { account, guest } = yield* findParticipants(actor, roomId)
  const participant = account ?? guest
  const isHost = actor.user !== null && roomRow.hostUserId === actor.user.id
  const online = yield* onlineParticipants(roomId, now)
  const facts: AdmissionFacts = {
    roomOpen: roomRow.status === "open",
    access: roomRow.access,
    signedIn: actor.user !== null,
    isHost,
    isHostFriend:
      actor.user !== null && roomRow.hostUserId !== null
        ? yield* areFriends(actor.user.id, roomRow.hostUserId)
        : false,
    participant: participant
      ? {
          state: participantState(participant, now),
          guest: participant.kind === "guest",
        }
      : null,
    validLink: yield* validLink(roomId, options.inviteToken, now),
    onlineCount: online.size,
    alreadyOnline: participant ? online.has(participant.id) : false,
  }
  const context: ViewerContext = {
    room: roomRow,
    participant,
    isHost,
    facts,
    status: decideAdmission(facts),
  }
  return context
})

const requireMember = Effect.fnUntraced(function* (
  actor: Actor,
  roomId: string,
  now: number,
  options: { lock?: boolean; open?: boolean } = {}
) {
  const context = yield* loadViewer(actor, roomId, now, options)
  if (!context) return yield* fail("unavailable", "This room is unavailable.")
  if (context.status !== "member" || !context.participant)
    return yield* fail("not_member", "You are not a member of this room.")
  if (options.open && context.room.status !== "open")
    return yield* fail("closed", "This room has closed.")
  return { ...context, participant: context.participant }
})

const requireHost = Effect.fnUntraced(function* (
  actor: Actor,
  roomId: string,
  now: number,
  options: { lock?: boolean } = { lock: true }
) {
  const context = yield* requireMember(actor, roomId, now, {
    ...options,
    open: true,
  })
  if (!context.isHost)
    return yield* fail("not_host", "Only the host can change this.")
  return context
})

export const insertMessage = Effect.fnUntraced(function* (input: {
  roomId: string
  participantId: string | null
  kind: RoomMessageKind
  body: string
  data?: unknown
  requestId?: string
}) {
  const { participantId, requestId } = input
  if (requestId && participantId) {
    const [existing] = yield* query((db) =>
      db
        .select()
        .from(roomMessage)
        .where(
          and(
            eq(roomMessage.roomId, input.roomId),
            eq(roomMessage.participantId, participantId),
            eq(roomMessage.requestId, requestId)
          )
        )
    )
    if (existing) return existing
  }
  const [counter] = yield* query((db) =>
    db
      .update(room)
      .set({ messageSeq: sql`${room.messageSeq} + 1` })
      .where(eq(room.id, input.roomId))
      .returning({ seq: room.messageSeq })
  )
  if (!counter) return yield* fail("unavailable", "This room is unavailable.")
  const [message] = yield* query((db) =>
    db
      .insert(roomMessage)
      .values({
        roomId: input.roomId,
        seq: counter.seq,
        participantId,
        kind: input.kind,
        body: input.body,
        data: input.data ?? null,
        requestId: requestId ?? null,
      })
      .returning()
  )
  if (!message) return yield* fail("failed", "Unable to send the message.")
  return message
})

const systemMessage = (roomId: string, body: string, data?: unknown) =>
  insertMessage({ roomId, participantId: null, kind: "system", body, data })

const participantName = Effect.fnUntraced(function* (
  participant: ParticipantRow
) {
  if (participant.kind === "guest") return participant.displayName ?? "Guest"
  const userId = participant.userId
  if (!userId) return "Deleted user"
  const [row] = yield* query((db) =>
    db.select(userFields).from(user).where(eq(user.id, userId))
  )
  return userDisplayName(row ?? null) ?? "Deleted user"
})

const bumpRevision = { revision: sql`${room.revision} + 1` }

const touchRoom = (roomId: string) =>
  query((db) => db.update(room).set(bumpRevision).where(eq(room.id, roomId)))

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

const selectMessages = (db: KaiserExecutor) =>
  db
    .select(messageSelection)
    .from(roomMessage)
    .leftJoin(
      roomParticipant,
      eq(roomParticipant.id, roomMessage.participantId)
    )
    .leftJoin(user, eq(user.id, roomParticipant.userId))

const latestMessages = (roomId: string, beforeSeq: number | null) =>
  query((db) =>
    selectMessages(db)
      .where(
        and(
          eq(roomMessage.roomId, roomId),
          beforeSeq === null ? undefined : lt(roomMessage.seq, beforeSeq)
        )
      )
      .orderBy(desc(roomMessage.seq))
      .limit(initialMessageCount + 1)
  ).pipe(
    Effect.map((rows) => ({
      messages: rows.slice(0, initialMessageCount).reverse().map(toMessage),
      hasEarlier: rows.length > initialMessageCount,
    }))
  )

const loadState = Effect.fnUntraced(function* (
  context: ViewerContext & { participant: ParticipantRow },
  connectionId: string | null,
  now: number
) {
  const roomRow = context.room
  const memberRows = yield* query((db) =>
    db
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
  )
  const hostFriends =
    roomRow.access === "friends" && roomRow.hostUserId
      ? new Set(yield* friendIdsOf(roomRow.hostUserId))
      : null
  const connections = yield* query((db) =>
    db
      .select()
      .from(roomConnection)
      .where(
        and(
          eq(roomConnection.roomId, roomRow.id),
          gt(roomConnection.lastSeenAt, liveCutoff(now))
        )
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

  const pickRows = yield* query((db) =>
    db
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
  )

  const selectedMalId = roomRow.malId
  const [selectedAnime] =
    selectedMalId === null
      ? []
      : yield* query((db) =>
          db
            .select()
            .from(animeMetadata)
            .where(eq(animeMetadata.malId, selectedMalId))
        )

  const host = members.find((member) => member.isHost) ?? null
  const hostUserId = roomRow.hostUserId
  const [hostRow] =
    host === null && hostUserId
      ? yield* query((db) =>
          db.select(userFields).from(user).where(eq(user.id, hostUserId))
        )
      : []
  const [aiPending] = yield* query((db) =>
    db
      .select({ actorKey: aiGeneration.actorKey })
      .from(aiGeneration)
      .where(
        and(
          eq(aiGeneration.roomId, roomRow.id),
          eq(aiGeneration.status, "running"),
          isNull(aiGeneration.threadId)
        )
      )
  )
  const ownConnections = connections.filter(
    (connection) => connection.participantId === context.participant.id
  )
  const canControlPlayback = roomRow.status === "open" && context.isHost

  const state: RoomState = {
    id: roomRow.id,
    name: roomRow.name,
    access: roomRow.access,
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
  return state
})

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

const summaryRows = (db: KaiserExecutor, userId: string, now: number) =>
  db
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

      const run = <A, R>(
        effect: Effect.Effect<A, RoomOperationError | DatabaseError, R>
      ) =>
        effect.pipe(
          Effect.tapErrorTag("DatabaseError", (error) =>
            Effect.logError("[Rooms] Database operation failed", error)
          ),
          Effect.catchTag("DatabaseError", () =>
            Effect.fail(fail("failed", "Something went wrong. Try again."))
          ),
          Effect.provideService(Database, database)
        )

      const transact = <A, R>(
        effect: Effect.Effect<A, RoomOperationError | DatabaseError, R>
      ) => run(database.transaction(effect))

      const create = Effect.fn("RoomService.create")(function* (
        hostUserId: string,
        input: {
          roomId: string
          name: string
          access: RoomAccess
          aiAccess: RoomAiAccess
          selection: (RoomEpisodeSelection & { positionSeconds: number }) | null
        }
      ) {
        const now = yield* Clock.currentTimeMillis
        const [existing] = yield* query((db) =>
          db
            .select({ hostUserId: room.hostUserId })
            .from(room)
            .where(eq(room.id, input.roomId))
        )
        if (existing) {
          if (existing.hostUserId !== hostUserId)
            return yield* fail("invalid", "Unable to create this room.")
          return { roomId: input.roomId }
        }
        const [recent] = yield* query((db) =>
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(room)
            .where(
              and(
                eq(room.hostUserId, hostUserId),
                gt(room.createdAt, new Date(now - 60 * 60 * 1000))
              )
            )
        )
        if ((recent?.count ?? 0) >= 10)
          return yield* fail(
            "rate_limited",
            "You've created a lot of rooms. Try again later."
          )
        const selection = input.selection
        if (selection) yield* upsertAnime(selection.anime)
        yield* query((db) =>
          db.insert(room).values({
            id: input.roomId,
            name: input.name,
            hostUserId,
            access: input.access,
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
        )
        yield* query((db) =>
          db.insert(roomParticipant).values({
            roomId: input.roomId,
            kind: "account",
            userId: hostUserId,
            state: "admitted",
            admittedAt: new Date(now),
          })
        )
        return { roomId: input.roomId }
      }, transact)

      const list = Effect.fn("RoomService.list")(function* (
        userId: string,
        tab: RoomListTab
      ) {
        const now = yield* Clock.currentTimeMillis
        const rows = yield* Effect.gen(function* () {
          switch (tab) {
            case "mine":
              return yield* query((db) =>
                summaryRows(db, userId, now)
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
              )
            case "invitations":
              return yield* query((db) =>
                summaryRows(db, userId, now)
                  .where(
                    and(
                      eq(roomParticipant.state, "invited"),
                      eq(room.status, "open")
                    )
                  )
                  .orderBy(desc(roomParticipant.updatedAt))
                  .limit(50)
              )
            case "friends": {
              const friends = yield* friendIdsOf(userId)
              if (friends.length === 0) return []
              return yield* query((db) =>
                summaryRows(db, userId, now)
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
              )
            }
            case "public":
              return yield* query((db) =>
                summaryRows(db, userId, now)
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
              )
          }
        })
        return rows.map((row) => toSummary(row, userId))
      }, run)

      const admission = Effect.fn("RoomService.admission")(function* (
        actor: Actor,
        roomId: string,
        inviteToken: string | undefined
      ) {
        const now = yield* Clock.currentTimeMillis
        const context = yield* loadViewer(actor, roomId, now, { inviteToken })
        if (!context)
          return {
            status: "unavailable",
            guestAllowed: false,
            room: null,
          } satisfies RoomAdmission
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
          } satisfies RoomAdmission
        const roomRow = context.room
        const { malId, hostUserId } = roomRow
        const [anime] =
          malId === null
            ? []
            : yield* query((db) =>
                db
                  .select()
                  .from(animeMetadata)
                  .where(eq(animeMetadata.malId, malId))
              )
        const [host] = hostUserId
          ? yield* query((db) =>
              db.select(userFields).from(user).where(eq(user.id, hostUserId))
            )
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
        } satisfies RoomAdmission
      }, run)

      const join = Effect.fn("RoomService.join")(function* (
        actor: Actor,
        roomId: string,
        inviteToken: string | undefined
      ) {
        const now = yield* Clock.currentTimeMillis
        const account = actor.user
        if (!account)
          return yield* fail("sign_in_required", "Sign in to join this room.")
        const context = yield* loadViewer(actor, roomId, now, {
          inviteToken,
          lock: true,
        })
        if (!context)
          return yield* fail("unavailable", "This room is unavailable.")
        if (context.status === "member") return
        if (context.status !== "joinable")
          return yield* fail(
            admissionError(context.status).reason,
            admissionError(context.status).message
          )
        const existing =
          context.participant?.kind === "account" ? context.participant : null
        if (existing) {
          yield* query((db) =>
            db
              .update(roomParticipant)
              .set({ state: "admitted", admittedAt: new Date(now) })
              .where(eq(roomParticipant.id, existing.id))
          )
        } else {
          yield* query((db) =>
            db.insert(roomParticipant).values({
              roomId,
              kind: "account",
              userId: account.id,
              state: "admitted",
              admittedAt: new Date(now),
            })
          )
        }
        const [joined] = yield* query((db) =>
          db
            .select()
            .from(roomParticipant)
            .where(
              and(
                eq(roomParticipant.roomId, roomId),
                eq(roomParticipant.userId, account.id)
              )
            )
        )
        if (joined)
          yield* systemMessage(
            roomId,
            `${yield* participantName(joined)} joined`
          )
        yield* touchRoom(roomId)
        yield* notifyRoom(roomId)
      }, transact)

      const admitGuest = Effect.fn("RoomService.admitGuest")(function* (
        roomId: string,
        inviteToken: string,
        displayName: string
      ) {
        const now = yield* Clock.currentTimeMillis
        const token = createOpaqueToken()
        const expiresAt = new Date(now + guestSessionMs)
        const context = yield* loadViewer(
          {
            user: null,
            guestTokens: [],
            sessionActive: Effect.succeed(true),
          },
          roomId,
          now,
          { inviteToken, lock: true }
        )
        if (!context)
          return yield* fail("unavailable", "This room is unavailable.")
        if (context.status !== "joinable" || context.room.access === "friends")
          return yield* fail(
            admissionError(context.status).reason,
            admissionError(context.status).message
          )
        yield* query((db) =>
          db.insert(roomParticipant).values({
            roomId,
            kind: "guest",
            guestTokenHash: hashToken(token),
            guestExpiresAt: expiresAt,
            displayName,
            state: "admitted",
            admittedAt: new Date(now),
          })
        )
        yield* systemMessage(roomId, `${displayName} joined as a guest`)
        yield* touchRoom(roomId)
        yield* notifyRoom(roomId)
        return { token, expiresAt }
      }, transact)

      const convertGuest = Effect.fn("RoomService.convertGuest")(function* (
        actor: Actor,
        roomId: string
      ) {
        const account = actor.user
        if (!account)
          return yield* fail("sign_in_required", "Sign in to keep this room.")
        const admittedAt = DateTime.toDateUtc(yield* DateTime.now)
        // Room before thread, matching AI publication's lock order.
        yield* findRoom(roomId, true)
        const { account: existing, guest } = yield* findParticipants(
          actor,
          roomId
        )
        if (!guest) return
        if (existing) {
          yield* query((db) =>
            db
              .update(roomMessage)
              .set({ participantId: existing.id })
              .where(eq(roomMessage.participantId, guest.id))
          )
          yield* query((db) =>
            db
              .update(roomPick)
              .set({ addedBy: existing.id })
              .where(eq(roomPick.addedBy, guest.id))
          )
          yield* query((db) =>
            db.execute(
              sql`insert into ${roomVote} (pick_id, participant_id, created_at)
                  select pick_id, ${existing.id}, created_at from ${roomVote}
                  where participant_id = ${guest.id}
                  on conflict do nothing`
            )
          )
          yield* query((db) =>
            db
              .update(recommendationThread)
              .set({
                ownerUserId: account.id,
                guestParticipantId: null,
                roomId: null,
              })
              .where(eq(recommendationThread.guestParticipantId, guest.id))
          )
          yield* query((db) =>
            db.delete(roomParticipant).where(eq(roomParticipant.id, guest.id))
          )
          if (existing.state !== "admitted" && existing.state !== "banned")
            yield* query((db) =>
              db
                .update(roomParticipant)
                .set({ state: "admitted", admittedAt })
                .where(eq(roomParticipant.id, existing.id))
            )
        } else {
          yield* query((db) =>
            db
              .update(recommendationThread)
              .set({
                ownerUserId: account.id,
                guestParticipantId: null,
                roomId: null,
              })
              .where(eq(recommendationThread.guestParticipantId, guest.id))
          )
          yield* query((db) =>
            db
              .update(roomParticipant)
              .set({
                kind: "account",
                userId: account.id,
                guestTokenHash: null,
                guestExpiresAt: null,
                displayName: null,
              })
              .where(eq(roomParticipant.id, guest.id))
          )
        }
        yield* touchRoom(roomId)
        yield* notifyRoom(roomId)
      }, transact)

      const markHostAwayIfGone = (roomIds: ReadonlyArray<string>, now: Date) =>
        roomIds.length === 0
          ? Effect.void
          : query((db) =>
              db.execute(sql`
                update ${room} set host_away_since = ${now}
                where ${room.id} in ${roomIds}
                  and ${room.hostAwaySince} is null
                  and not exists (
                    select 1 from ${roomConnection} c
                    join ${roomParticipant} p on p.id = c.participant_id
                    where c.room_id = ${room.id} and p.user_id = ${room.hostUserId}
                  )`)
            )

      const disconnect = Effect.fnUntraced(
        function* (streamId: string) {
          const now = DateTime.toDateUtc(yield* DateTime.now)
          const [connection] = yield* query((db) =>
            db
              .delete(roomConnection)
              .where(eq(roomConnection.id, streamId))
              .returning()
          )
          if (!connection) return
          if (connection.controller) {
            const remaining = yield* query((db) =>
              db
                .select({
                  id: roomConnection.id,
                  tabId: roomConnection.tabId,
                })
                .from(roomConnection)
                .where(
                  eq(roomConnection.participantId, connection.participantId)
                )
                .orderBy(asc(roomConnection.connectedAt))
            )
            const sameTab = remaining.some(
              (row) => row.tabId === connection.tabId
            )
            const next = remaining[0]
            if (!sameTab && next)
              yield* query((db) =>
                db
                  .update(roomConnection)
                  .set({ controller: true })
                  .where(eq(roomConnection.tabId, next.tabId))
              )
          }
          yield* markHostAwayIfGone([connection.roomId], now)
          yield* notifyRoom(connection.roomId)
        },
        transact,
        (effect, streamId) =>
          Effect.ensuring(
            effect,
            Effect.sync(() => live.delete(streamId))
          )
      )

      const connect = Effect.fnUntraced(function* (
        actor: Actor,
        roomId: string,
        connectionId: string,
        streamId: string,
        connectedAt: number
      ) {
        const context = yield* requireMember(actor, roomId, connectedAt, {
          lock: true,
        })
        const online = yield* onlineParticipants(roomId, connectedAt)
        online.delete(context.participant.id)
        if (online.size >= RoomCapacity)
          return yield* fail("full", "This room is full.")
        const controllers = yield* query((db) =>
          db
            .select({ tabId: roomConnection.tabId })
            .from(roomConnection)
            .where(
              and(
                eq(roomConnection.participantId, context.participant.id),
                eq(roomConnection.controller, true)
              )
            )
        )
        yield* query((db) =>
          db.insert(roomConnection).values({
            id: streamId,
            tabId: connectionId,
            roomId,
            participantId: context.participant.id,
            runtimeId,
            controller:
              controllers.length === 0 ||
              controllers.some((row) => row.tabId === connectionId),
          })
        )
        yield* query((db) =>
          db
            .update(roomParticipant)
            .set({ lastSeenAt: new Date(connectedAt) })
            .where(eq(roomParticipant.id, context.participant.id))
        )
        yield* query((db) =>
          db
            .update(room)
            .set({
              lastConnectedAt: new Date(connectedAt),
              ...(context.isHost ? { hostAwaySince: null } : {}),
            })
            .where(eq(room.id, roomId))
        )
        yield* notifyRoom(roomId)
      }, transact)

      type Accumulator = {
        lastSeq: number | null
        lastState: string | null
        lastReloadAt: number
        sessionCheckedAt: number
      }

      const newMessages = (roomId: string, lastSeq: number, since: number) =>
        query((db) =>
          selectMessages(db)
            .where(
              and(
                eq(roomMessage.roomId, roomId),
                or(
                  gt(roomMessage.seq, lastSeq),
                  gt(roomMessage.deletedAt, new Date(since - 1000))
                )
              )
            )
            .orderBy(asc(roomMessage.seq))
            .limit(200)
        )

      const reload = Effect.fnUntraced(function* (
        actor: Actor,
        roomId: string,
        connectionId: string,
        connectedAt: number,
        acc: Accumulator
      ) {
        const now = yield* Clock.currentTimeMillis
        let sessionCheckedAt = acc.sessionCheckedAt
        if (actor.user && now - sessionCheckedAt > 60_000) {
          if (!(yield* actor.sessionActive))
            return [
              acc,
              [{ _tag: "Ended", reason: "signed_out" } as const],
            ] as const
          sessionCheckedAt = now
        }
        const context = yield* loadViewer(actor, roomId, now)
        if (context?.status !== "member" || !context.participant)
          return [
            acc,
            [{ _tag: "Ended", reason: endReason(context) } as const],
          ] as const
        const state = yield* loadState(
          { ...context, participant: context.participant },
          connectionId,
          now
        )
        const output: Array<RoomEvent> = []
        const fingerprint = JSON.stringify({ ...state, serverTime: 0 })
        if (fingerprint !== acc.lastState) output.push({ _tag: "State", state })
        let lastSeq = acc.lastSeq
        if (lastSeq === null) {
          const page = yield* latestMessages(roomId, null)
          output.push({ _tag: "Messages", ...page })
          lastSeq = page.messages.at(-1)?.seq ?? 0
        } else {
          const rows = yield* newMessages(roomId, lastSeq, acc.lastReloadAt)
          if (rows.length > 0) {
            const messages = rows.map(toMessage)
            output.push({ _tag: "Messages", messages, hasEarlier: false })
            lastSeq = Math.max(lastSeq, ...messages.map((m) => m.seq))
          }
        }
        const next: Accumulator = {
          lastSeq,
          lastState: fingerprint,
          lastReloadAt: connectedAt,
          sessionCheckedAt,
        }
        return [next, output] as const
      }, run)

      const watch = (actor: Actor, roomId: string, connectionId: string) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const signals = yield* events.subscribe(roomId)
            const streamId = crypto.randomUUID()
            const connectedAt = yield* Clock.currentTimeMillis
            yield* connect(actor, roomId, connectionId, streamId, connectedAt)
            live.add(streamId)
            yield* Effect.addFinalizer(() =>
              disconnect(streamId).pipe(Effect.ignore)
            )

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
                (acc) => reload(actor, roomId, connectionId, connectedAt, acc)
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
        yield* requireMember(actor, roomId, now)
        return yield* latestMessages(roomId, beforeSeq)
      }, run)

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
        const context = yield* requireMember(actor, roomId, now, {
          open: true,
        })
        const [recent] = yield* query((db) =>
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(roomMessage)
            .where(
              and(
                eq(roomMessage.roomId, roomId),
                eq(roomMessage.participantId, context.participant.id),
                gt(roomMessage.createdAt, new Date(now - 10_000))
              )
            )
        )
        if ((recent?.count ?? 0) >= 8)
          return yield* fail(
            "rate_limited",
            "You're sending messages too quickly."
          )
        const message = yield* insertMessage({
          roomId,
          participantId: context.participant.id,
          kind: "text",
          body: text,
          requestId,
        })
        yield* notifyRoom(roomId)
        const [row] = yield* query((db) =>
          selectMessages(db).where(eq(roomMessage.id, message.id))
        )
        if (!row) return yield* fail("failed", "Unable to send the message.")
        return toMessage(row)
      }, transact)

      const deleteMessage = Effect.fn("RoomService.deleteMessage")(function* (
        actor: Actor,
        roomId: string,
        messageId: string
      ) {
        const now = yield* Clock.currentTimeMillis
        const context = yield* requireMember(actor, roomId, now, {
          open: true,
        })
        const [message] = yield* query((db) =>
          db
            .select()
            .from(roomMessage)
            .where(
              and(eq(roomMessage.id, messageId), eq(roomMessage.roomId, roomId))
            )
        )
        if (!message) return
        if (!context.isHost && message.participantId !== context.participant.id)
          return yield* fail(
            "not_host",
            "Only the host can remove other messages."
          )
        yield* query((db) =>
          db
            .update(roomMessage)
            .set({ deletedAt: new Date(now) })
            .where(eq(roomMessage.id, messageId))
        )
        yield* notifyRoom(roomId)
      }, transact)

      const command = Effect.fn("RoomService.command")(function* (
        actor: Actor,
        roomId: string,
        selectionRevision: number,
        action: RoomPlaybackAction
      ) {
        const now = yield* Clock.currentTimeMillis
        const context = yield* requireMember(actor, roomId, now, {
          lock: true,
          open: true,
        })
        const roomRow = context.room
        if (!context.isHost)
          return yield* fail("cannot_control", "The host controls playback.")
        if (roomRow.malId === null)
          return yield* fail("invalid", "Choose an episode first.")
        if (roomRow.selectionRevision !== selectionRevision)
          return yield* fail(
            "stale",
            "The episode changed. Your player is catching up."
          )
        const next = (() => {
          switch (action._tag) {
            case "Play":
              return { playing: true, positionSeconds: action.positionSeconds }
            case "Pause":
              return { playing: false, positionSeconds: action.positionSeconds }
            case "Seek":
              return {
                playing: roomRow.playing,
                positionSeconds: action.positionSeconds,
              }
            case "Rate":
              return {
                playing: roomRow.playing,
                positionSeconds: action.positionSeconds,
                rate: action.rate,
              }
          }
        })()
        yield* query((db) =>
          db
            .update(room)
            .set({ ...next, positionAt: new Date(now), ...bumpRevision })
            .where(eq(room.id, roomId))
        )
        yield* notifyRoom(roomId)
      }, transact)

      const selectEpisode = Effect.fn("RoomService.selectEpisode")(function* (
        actor: Actor,
        roomId: string,
        selection: RoomEpisodeSelection | null,
        play = false
      ) {
        const now = yield* Clock.currentTimeMillis
        yield* requireHost(actor, roomId, now)
        if (selection) yield* upsertAnime(selection.anime)
        yield* query((db) =>
          db
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
        )
        yield* systemMessage(
          roomId,
          selection
            ? `Now watching ${animeTitle(selection.anime)} · Episode ${selection.episodeNumber}`
            : "The host is choosing what to watch next",
          selection
            ? { type: "selection", malId: selection.anime.malId }
            : { type: "choosing" }
        )
        yield* notifyRoom(roomId)
      }, transact)

      const claimPlayback = Effect.fn("RoomService.claimPlayback")(function* (
        actor: Actor,
        roomId: string,
        connectionId: string
      ) {
        const now = yield* Clock.currentTimeMillis
        const context = yield* requireMember(actor, roomId, now)
        const [connection] = yield* query((db) =>
          db
            .select()
            .from(roomConnection)
            .where(
              and(
                eq(roomConnection.tabId, connectionId),
                eq(roomConnection.participantId, context.participant.id)
              )
            )
        )
        if (!connection)
          return yield* fail("invalid", "Reconnect to the room and try again.")
        yield* query((db) =>
          db
            .update(roomConnection)
            .set({
              controller: sql`${roomConnection.tabId} = ${connectionId}`,
            })
            .where(eq(roomConnection.participantId, context.participant.id))
        )
        yield* notifyRoom(roomId)
      }, transact)

      const reportPlaybackState = Effect.fn("RoomService.reportPlaybackState")(
        function* (
          actor: Actor,
          roomId: string,
          connectionId: string,
          state: RoomPlaybackState
        ) {
          const now = yield* Clock.currentTimeMillis
          const context = yield* requireMember(actor, roomId, now)
          const updated = yield* query((db) =>
            db
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
          )
          if (updated.length > 0) yield* notifyRoom(roomId)
        },
        transact
      )

      const ineligibleForAccess = Effect.fnUntraced(function* (
        roomRow: RoomRow,
        access: RoomAccess
      ) {
        if (access !== "friends") return []
        const friends = roomRow.hostUserId
          ? new Set(yield* friendIdsOf(roomRow.hostUserId))
          : new Set<string>()
        const rows = yield* query((db) =>
          db
            .select({ participant: roomParticipant, ...userFields })
            .from(roomParticipant)
            .leftJoin(user, eq(user.id, roomParticipant.userId))
            .where(
              and(
                eq(roomParticipant.roomId, roomRow.id),
                inArray(roomParticipant.state, ["admitted", "invited"])
              )
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
      })

      const previewAccessChange = Effect.fn("RoomService.previewAccessChange")(
        function* (actor: Actor, roomId: string, access: RoomAccess) {
          const now = yield* Clock.currentTimeMillis
          const context = yield* requireHost(actor, roomId, now, {
            lock: false,
          })
          const current = context.room.access
          return {
            removed: yield* ineligibleForAccess(context.room, access),
            broadens: access !== current && current !== "public",
          }
        },
        run
      )

      const updateSettings = Effect.fn("RoomService.updateSettings")(function* (
        actor: Actor,
        roomId: string,
        input: {
          name?: string
          access?: RoomAccess
          aiAccess?: RoomAiAccess
        }
      ) {
        const now = yield* Clock.currentTimeMillis
        const context = yield* requireHost(actor, roomId, now)
        if (input.access && input.access !== context.room.access) {
          const removed = yield* ineligibleForAccess(context.room, input.access)
          const removedIds = removed.map((entry) => entry.id)
          if (removedIds.length > 0) {
            yield* query((db) =>
              db
                .update(roomParticipant)
                .set({ state: "removed" })
                .where(inArray(roomParticipant.id, removedIds))
            )
            yield* query((db) =>
              db
                .delete(roomConnection)
                .where(inArray(roomConnection.participantId, removedIds))
            )
          }
          const label = {
            public: "Public",
            friends: "Friends only",
            invite: "Invite only",
          }[input.access]
          yield* systemMessage(roomId, `Room access changed to ${label}`)
        }
        if (input.aiAccess && input.aiAccess !== context.room.aiAccess)
          yield* systemMessage(
            roomId,
            {
              off: "Room AI turned off",
              host: "Only the host can ask AI",
              everyone: "Everyone can ask AI",
            }[input.aiAccess]
          )
        yield* query((db) =>
          db
            .update(room)
            .set({ ...input, ...bumpRevision })
            .where(eq(room.id, roomId))
        )
        yield* notifyRoom(roomId)
      }, transact)

      const createInviteLink = Effect.fn("RoomService.createInviteLink")(
        function* (actor: Actor, roomId: string) {
          const now = yield* Clock.currentTimeMillis
          const token = createOpaqueToken()
          const expiresAt = new Date(now + inviteLinkMs)
          const context = yield* requireHost(actor, roomId, now)
          const [active] = yield* query((db) =>
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(roomInviteLink)
              .where(
                and(
                  eq(roomInviteLink.roomId, roomId),
                  isNull(roomInviteLink.revokedAt),
                  gt(roomInviteLink.expiresAt, new Date(now))
                )
              )
          )
          if ((active?.count ?? 0) >= maxActiveLinks)
            return yield* fail(
              "rate_limited",
              "Revoke old invite links before creating more."
            )
          yield* query((db) =>
            db.insert(roomInviteLink).values({
              roomId,
              tokenHash: hashToken(token),
              createdBy: context.room.hostUserId,
              expiresAt,
            })
          )
          return { token, expiresAt: expiresAt.getTime() }
        },
        transact
      )

      const revokeInviteLinks = Effect.fn("RoomService.revokeInviteLinks")(
        function* (actor: Actor, roomId: string) {
          const now = yield* Clock.currentTimeMillis
          yield* requireHost(actor, roomId, now)
          yield* query((db) =>
            db
              .update(roomInviteLink)
              .set({ revokedAt: new Date(now) })
              .where(
                and(
                  eq(roomInviteLink.roomId, roomId),
                  isNull(roomInviteLink.revokedAt)
                )
              )
          )
        },
        transact
      )

      const invite = Effect.fn("RoomService.invite")(function* (
        actor: Actor,
        roomId: string,
        userIds: ReadonlyArray<string>
      ) {
        const now = yield* Clock.currentTimeMillis
        const context = yield* requireHost(actor, roomId, now)
        const hostId = context.room.hostUserId
        if (!hostId) return yield* fail("not_host", "Only the host can invite.")
        const friends = new Set(yield* friendIdsOf(hostId))
        const targets = [...new Set(userIds)].filter((id) => friends.has(id))
        for (const userId of targets) {
          yield* query((db) =>
            db
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
          )
        }
        yield* notifyRoom(roomId)
      }, transact)

      const declineInvitation = Effect.fn("RoomService.declineInvitation")(
        function* (userId: string, roomId: string) {
          yield* query((db) =>
            db
              .delete(roomParticipant)
              .where(
                and(
                  eq(roomParticipant.roomId, roomId),
                  eq(roomParticipant.userId, userId),
                  eq(roomParticipant.state, "invited")
                )
              )
          )
        },
        run
      )

      const removeParticipant = Effect.fn("RoomService.removeParticipant")(
        function* (
          actor: Actor,
          roomId: string,
          participantId: string,
          ban: boolean
        ) {
          const now = yield* Clock.currentTimeMillis
          const context = yield* requireHost(actor, roomId, now)
          const [target] = yield* query((db) =>
            db
              .select()
              .from(roomParticipant)
              .where(
                and(
                  eq(roomParticipant.id, participantId),
                  eq(roomParticipant.roomId, roomId)
                )
              )
          )
          if (!target || target.id === context.participant.id)
            return yield* fail("invalid", "That member can't be removed.")
          yield* query((db) =>
            db
              .update(roomParticipant)
              .set({ state: ban ? "banned" : "removed" })
              .where(eq(roomParticipant.id, participantId))
          )
          yield* query((db) =>
            db
              .delete(roomConnection)
              .where(eq(roomConnection.participantId, participantId))
          )
          const name = yield* participantName(target)
          yield* systemMessage(
            roomId,
            ban ? `${name} was banned` : `${name} was removed`
          )
          yield* touchRoom(roomId)
          yield* notifyRoom(roomId)
        },
        transact
      )

      const transferHost = Effect.fn("RoomService.transferHost")(function* (
        actor: Actor,
        roomId: string,
        participantId: string
      ) {
        const now = yield* Clock.currentTimeMillis
        const context = yield* requireHost(actor, roomId, now)
        const [target] = yield* query((db) =>
          db
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
        )
        const online = yield* onlineParticipants(roomId, now)
        const targetUserId = target?.userId
        if (!target || !targetUserId || !online.has(target.id))
          return yield* fail(
            "invalid",
            "Hosting can only move to a signed-in member who is here now."
          )
        if (
          context.room.access === "friends" &&
          !(yield* areFriends(context.room.hostUserId ?? "", targetUserId))
        )
          return yield* fail("invalid", "That member can't host this room.")
        yield* query((db) =>
          db
            .update(room)
            .set({
              hostUserId: targetUserId,
              hostAwaySince: null,
              ...bumpRevision,
            })
            .where(eq(room.id, roomId))
        )
        yield* systemMessage(
          roomId,
          `${yield* participantName(target)} is now the host`
        )
        yield* notifyRoom(roomId)
      }, transact)

      const leave = Effect.fn("RoomService.leave")(function* (
        actor: Actor,
        roomId: string
      ) {
        const now = yield* Clock.currentTimeMillis
        const context = yield* requireMember(actor, roomId, now, {
          lock: true,
        })
        if (context.isHost && context.room.status === "open")
          return yield* fail(
            "host_must_transfer",
            "Transfer hosting or close the room before leaving."
          )
        yield* query((db) =>
          db
            .update(roomParticipant)
            .set({ state: "left" })
            .where(eq(roomParticipant.id, context.participant.id))
        )
        yield* query((db) =>
          db
            .delete(roomConnection)
            .where(eq(roomConnection.participantId, context.participant.id))
        )
        if (context.room.status === "open")
          yield* systemMessage(
            roomId,
            `${yield* participantName(context.participant)} left`
          )
        yield* touchRoom(roomId)
        yield* notifyRoom(roomId)
      }, transact)

      const close = Effect.fn("RoomService.close")(function* (
        actor: Actor,
        roomId: string,
        remove: boolean
      ) {
        const now = yield* Clock.currentTimeMillis
        const context = yield* requireMember(actor, roomId, now, {
          lock: true,
        })
        if (!context.isHost)
          return yield* fail("not_host", "Only the host can close this room.")
        if (remove) {
          yield* notifyRoom(roomId)
          yield* query((db) => db.delete(room).where(eq(room.id, roomId)))
          return
        }
        if (context.room.status === "closed") return
        yield* query((db) =>
          db
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
        )
        yield* query((db) =>
          db
            .update(roomInviteLink)
            .set({ revokedAt: new Date(now) })
            .where(
              and(
                eq(roomInviteLink.roomId, roomId),
                isNull(roomInviteLink.revokedAt)
              )
            )
        )
        yield* systemMessage(roomId, "The host closed the room")
        yield* notifyRoom(roomId)
      }, transact)

      const addPick = Effect.fn("RoomService.addPick")(function* (
        actor: Actor,
        roomId: string,
        anime: AnimeLibraryMetadata
      ) {
        const now = yield* Clock.currentTimeMillis
        const context = yield* requireMember(actor, roomId, now, {
          open: true,
        })
        const [picks] = yield* query((db) =>
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(roomPick)
            .where(eq(roomPick.roomId, roomId))
        )
        if ((picks?.count ?? 0) >= maxPicks)
          return yield* fail("invalid", "The shortlist is full.")
        yield* upsertAnime(anime)
        const inserted = yield* query((db) =>
          db
            .insert(roomPick)
            .values({
              roomId,
              malId: anime.malId,
              addedBy: context.participant.id,
            })
            .onConflictDoNothing()
            .returning({ id: roomPick.id })
        )
        if (inserted.length === 0) return
        yield* systemMessage(
          roomId,
          `${yield* participantName(context.participant)} suggested ${animeTitle(anime)}`,
          { type: "pick", malId: anime.malId }
        )
        yield* notifyRoom(roomId)
      }, transact)

      const removePick = Effect.fn("RoomService.removePick")(function* (
        actor: Actor,
        roomId: string,
        pickId: string
      ) {
        const now = yield* Clock.currentTimeMillis
        yield* requireHost(actor, roomId, now, { lock: false })
        yield* query((db) =>
          db
            .delete(roomPick)
            .where(and(eq(roomPick.id, pickId), eq(roomPick.roomId, roomId)))
        )
        yield* notifyRoom(roomId)
      }, transact)

      const vote = Effect.fn("RoomService.vote")(function* (
        actor: Actor,
        roomId: string,
        pickId: string,
        value: boolean
      ) {
        const now = yield* Clock.currentTimeMillis
        const context = yield* requireMember(actor, roomId, now, {
          open: true,
        })
        const [pick] = yield* query((db) =>
          db
            .select({ id: roomPick.id })
            .from(roomPick)
            .where(and(eq(roomPick.id, pickId), eq(roomPick.roomId, roomId)))
        )
        if (!pick) return yield* fail("invalid", "That pick was removed.")
        if (value)
          yield* query((db) =>
            db
              .insert(roomVote)
              .values({ pickId, participantId: context.participant.id })
              .onConflictDoNothing()
          )
        else
          yield* query((db) =>
            db
              .delete(roomVote)
              .where(
                and(
                  eq(roomVote.pickId, pickId),
                  eq(roomVote.participantId, context.participant.id)
                )
              )
          )
        yield* notifyRoom(roomId)
      }, transact)

      const setTasteSharing = Effect.fn("RoomService.setTasteSharing")(
        function* (userId: string, roomId: string, share: boolean) {
          const updated = yield* query((db) =>
            db
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
          )
          if (updated.length === 0)
            return yield* fail(
              "not_member",
              "You are not a member of this room."
            )
          yield* notifyRoom(roomId)
        },
        transact
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
        const [membership] = yield* query((db) =>
          db
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
        )
        if (!membership)
          return yield* fail("not_member", "You are not a member of this room.")
        const roomRow = membership.room
        const matchesRoom =
          roomRow.malId === input.anime.malId &&
          roomRow.episodeId === input.episodeId
        yield* upsertAnime(input.anime)
        const key = and(
          eq(watchCoverage.userId, userId),
          eq(watchCoverage.malId, input.anime.malId),
          eq(watchCoverage.episode, input.episode)
        )
        const [existing] = yield* query((db) =>
          db.select().from(watchCoverage).where(key).for("update")
        )
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
        yield* query((db) =>
          db
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
        )

        const [history] = yield* query((db) =>
          db
            .select({ status: watchHistory.status })
            .from(watchHistory)
            .where(
              and(
                eq(watchHistory.userId, userId),
                eq(watchHistory.malId, input.anime.malId),
                eq(watchHistory.episode, input.episode)
              )
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
          yield* query((db) =>
            db
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
          )
        }
        return {
          coveredSeconds: coveredSeconds(intervals),
          completed,
          newlyCompleted: completed && !wasComplete,
        }
      }, transact)

      const refreshLeases = Effect.fn("RoomService.refreshLeases")(
        function* () {
          const ids = [...live.keys()]
          if (ids.length === 0) return
          const now = DateTime.toDateUtc(yield* DateTime.now)
          const rows = yield* query((db) =>
            db
              .update(roomConnection)
              .set({ lastSeenAt: now })
              .where(inArray(roomConnection.id, ids))
              .returning({ roomId: roomConnection.roomId })
          )
          const roomIds = [...new Set(rows.map((row) => row.roomId))]
          if (roomIds.length > 0)
            yield* query((db) =>
              db
                .update(room)
                .set({ lastConnectedAt: now })
                .where(inArray(room.id, roomIds))
            )
        },
        transact
      )

      const pausedAt = (at: Date | ReturnType<typeof sql>) =>
        sql`${room.positionSeconds} + greatest(0, extract(epoch from (${at} - ${room.positionAt}))) * ${room.rate}`

      const sweep = Effect.fn("RoomService.sweep")(function* () {
        const now = DateTime.toDateUtc(yield* DateTime.now)
        const touched = new Set<string>()
        const stale = yield* query((db) =>
          db
            .delete(roomConnection)
            .where(lt(roomConnection.lastSeenAt, liveCutoff(now.getTime())))
            .returning({ roomId: roomConnection.roomId })
        )
        for (const row of stale) touched.add(row.roomId)
        yield* markHostAwayIfGone([...touched], now)

        const paused = yield* query((db) =>
          db
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
        )
        for (const row of paused) touched.add(row.id)

        const closed = yield* query((db) =>
          db
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
        )
        for (const row of closed) touched.add(row.id)

        const expired = yield* query((db) =>
          db
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
        )
        for (const row of expired) touched.add(row.roomId)

        yield* query((db) =>
          db
            .delete(room)
            .where(
              and(
                eq(room.status, "closed"),
                lt(room.closedAt, new Date(now.getTime() - retentionMs))
              )
            )
        )

        for (const roomId of touched) yield* notifyRoom(roomId)
      }, transact)

      // Single API instance: connections owned by an earlier process are dead.
      // Playback pauses where it was when the old process last saw its members,
      // instead of advancing across the outage.
      const recoverAfterRestart = Effect.fn("RoomService.recoverAfterRestart")(
        function* () {
          const now = DateTime.toDateUtc(yield* DateTime.now)
          yield* query((db) =>
            db
              .delete(roomConnection)
              .where(ne(roomConnection.runtimeId, runtimeId))
          )
          yield* query((db) =>
            db
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
          )
          yield* query((db) =>
            db
              .update(room)
              .set({ hostAwaySince: now })
              .where(and(eq(room.status, "open"), isNull(room.hostAwaySince)))
          )
        },
        transact
      )

      const postMessage = Effect.fnUntraced(function* (
        input: Parameters<typeof insertMessage>[0]
      ) {
        const message = yield* insertMessage(input)
        yield* notifyRoom(input.roomId)
        return message
      }, transact)

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
        insertMessage: postMessage,
      }
    }),
  }
) {
  static readonly layer = Layer.effect(RoomService, RoomService.make).pipe(
    Layer.provide(RoomEvents.layer)
  )
}
