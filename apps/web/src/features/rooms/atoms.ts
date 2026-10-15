import type {
  RoomEndReason,
  RoomEvent,
  RoomListTab,
  RoomMessage,
  RoomOperationError,
  RoomState,
} from "@animekaiser/domain"
import { Atom } from "@effect-atom/atom-react"
import * as Effect from "effect/Effect"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"
import { KaiserRpcClient } from "../../services/api-clients"

export const roomReactivityKeys = {
  lists: "rooms",
  admission: (roomId: string) => `room-admission:${roomId}`,
}

export const roomListAtom = Atom.family((tab: RoomListTab) =>
  KaiserRpcClient.query(
    "ListRooms",
    { tab },
    { reactivityKeys: [roomReactivityKeys.lists] }
  )
)

const admissionFamily = Atom.family((key: string) => {
  const [roomId = "", inviteToken] = key.split("\n")
  return KaiserRpcClient.query(
    "GetRoomAdmission",
    { roomId, inviteToken: inviteToken || undefined },
    {
      reactivityKeys: [
        roomReactivityKeys.lists,
        roomReactivityKeys.admission(roomId),
      ],
    }
  )
})

export const roomAdmissionAtom = ({
  roomId,
  inviteToken,
}: {
  roomId: string
  inviteToken?: string
}) => admissionFamily(`${roomId}\n${inviteToken ?? ""}`)

export const createRoomAtom = KaiserRpcClient.mutation("CreateRoom")
export const joinRoomAtom = KaiserRpcClient.mutation("JoinRoom")
export const declineRoomInvitationAtom = KaiserRpcClient.mutation(
  "DeclineRoomInvitation"
)
export const leaveRoomAtom = KaiserRpcClient.mutation("LeaveRoom")
export const closeRoomAtom = KaiserRpcClient.mutation("CloseRoom")
export const sendRoomMessageAtom = KaiserRpcClient.mutation("SendRoomMessage")
export const deleteRoomMessageAtom =
  KaiserRpcClient.mutation("DeleteRoomMessage")
export const commandRoomPlaybackAtom = KaiserRpcClient.mutation(
  "CommandRoomPlayback"
)
export const selectRoomEpisodeAtom =
  KaiserRpcClient.mutation("SelectRoomEpisode")
export const claimRoomPlaybackAtom =
  KaiserRpcClient.mutation("ClaimRoomPlayback")
export const reportRoomPlaybackStateAtom = KaiserRpcClient.mutation(
  "ReportRoomPlaybackState"
)
export const updateRoomSettingsAtom =
  KaiserRpcClient.mutation("UpdateRoomSettings")
export const previewRoomAccessChangeAtom = KaiserRpcClient.mutation(
  "PreviewRoomAccessChange"
)
export const createRoomInviteLinkAtom = KaiserRpcClient.mutation(
  "CreateRoomInviteLink"
)
export const revokeRoomInviteLinksAtom = KaiserRpcClient.mutation(
  "RevokeRoomInviteLinks"
)
export const inviteToRoomAtom = KaiserRpcClient.mutation("InviteToRoom")
export const removeRoomParticipantAtom = KaiserRpcClient.mutation(
  "RemoveRoomParticipant"
)
export const transferRoomHostAtom = KaiserRpcClient.mutation("TransferRoomHost")
export const addRoomPickAtom = KaiserRpcClient.mutation("AddRoomPick")
export const removeRoomPickAtom = KaiserRpcClient.mutation("RemoveRoomPick")
export const toggleRoomVoteAtom = KaiserRpcClient.mutation("ToggleRoomVote")
export const setRoomTasteSharingAtom = KaiserRpcClient.mutation(
  "SetRoomTasteSharing"
)
export const recordRoomViewingAtom =
  KaiserRpcClient.mutation("RecordRoomViewing")
export const convertRoomGuestAtom = KaiserRpcClient.mutation("ConvertRoomGuest")

const activeRoomStorageKey = "kaiser.activeRoom"

const readActiveRoom = () => {
  try {
    return window.localStorage.getItem(activeRoomStorageKey)
  } catch {
    return null
  }
}

const activeRoomStoreAtom = Atom.make<string | null>(readActiveRoom()).pipe(
  Atom.keepAlive
)

// The room this browser stays connected to while browsing elsewhere; it is
// remembered across reloads until the viewer leaves or loses access.
export const activeRoomIdAtom = Atom.writable(
  (get) => get(activeRoomStoreAtom),
  (ctx, roomId: string | null) => {
    try {
      if (roomId) window.localStorage.setItem(activeRoomStorageKey, roomId)
      else window.localStorage.removeItem(activeRoomStorageKey)
    } catch {}
    ctx.set(activeRoomStoreAtom, roomId)
  }
)

// Why this browser last lost a room, so the room page can explain it instead
// of retrying with stale admission results.
export const endedRoomsAtom = Atom.make<ReadonlyMap<string, string>>(
  new Map()
).pipe(Atom.keepAlive)

// One id per tab and room: the server uses it to give exactly one tab of a
// participant control of local playback.
export const roomConnectionIdAtom = Atom.family((_roomId: string) =>
  Atom.make(() => crypto.randomUUID()).pipe(Atom.keepAlive)
)

export type RoomLive = {
  readonly state: RoomState | null
  readonly messages: ReadonlyArray<RoomMessage>
  readonly hasEarlier: boolean
  readonly connected: boolean
  readonly ended: RoomEndReason | null
  readonly failure: RoomOperationError | null
}

const initialLive: RoomLive = {
  state: null,
  messages: [],
  hasEarlier: false,
  connected: false,
  ended: null,
  failure: null,
}

type LiveSignal =
  | RoomEvent
  | { readonly _tag: "Disconnected" }
  | { readonly _tag: "Failed"; readonly error: RoomOperationError }

export const mergeMessages = (
  current: ReadonlyArray<RoomMessage>,
  incoming: ReadonlyArray<RoomMessage>
) => {
  const byId = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort((left, right) => left.seq - right.seq)
}

const reduceLive = (live: RoomLive, signal: LiveSignal): RoomLive => {
  switch (signal._tag) {
    case "State":
      return { ...live, state: signal.state, connected: true, failure: null }
    case "Messages":
      return {
        ...live,
        messages: mergeMessages(live.messages, signal.messages),
        hasEarlier:
          live.messages.length === 0 ? signal.hasEarlier : live.hasEarlier,
      }
    case "Ended":
      return { ...live, ended: signal.reason, connected: false }
    case "Disconnected":
      return { ...live, connected: false }
    case "Failed":
      return { ...live, failure: signal.error, connected: false }
  }
}

export const roomLiveAtom = Atom.family((roomId: string) =>
  KaiserRpcClient.runtime
    .atom((get) => {
      const connectionId = get(roomConnectionIdAtom(roomId))
      const watch: Stream.Stream<
        LiveSignal,
        RoomOperationError | "reconnect",
        KaiserRpcClient
      > = Stream.unwrap(
        Effect.map(KaiserRpcClient, (client) =>
          client("WatchRoom", { roomId, connectionId }).pipe(
            Stream.mapError((error) =>
              error._tag === "RoomOperationError"
                ? error
                : ("reconnect" as const)
            )
          )
        )
      )
      const events = watch.pipe(
        Stream.catchAll((error) =>
          error === "reconnect"
            ? Stream.succeed<LiveSignal>({ _tag: "Disconnected" }).pipe(
                Stream.concat(Stream.fail("reconnect" as const))
              )
            : Stream.succeed<LiveSignal>({ _tag: "Failed", error })
        ),
        Stream.retry(
          Schedule.exponential("500 millis").pipe(
            Schedule.either(Schedule.spaced("5 seconds"))
          )
        ),
        Stream.orDie
      )
      return events.pipe(
        Stream.scan(initialLive, (live: RoomLive, signal: LiveSignal) =>
          reduceLive(live, signal)
        )
      )
    })
    .pipe(Atom.keepAlive)
)

// Offset to add to `Date.now()` to read server time, taken from the sample
// with the shortest round trip so network jitter skews it least.
export const roomClockOffsetAtom = KaiserRpcClient.runtime
  .atom(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      let best: { offset: number; rtt: number } | null = null
      for (let sample = 0; sample < 4; sample++) {
        const sentAt = Date.now()
        const { serverTime } = yield* client("GetRoomClock", void 0)
        const receivedAt = Date.now()
        const rtt = receivedAt - sentAt
        if (!best || rtt < best.rtt)
          best = { offset: serverTime - (sentAt + receivedAt) / 2, rtt }
      }
      return best?.offset ?? 0
    }).pipe(Effect.orElseSucceed(() => 0))
  )
  .pipe(Atom.keepAlive)

export const roomAccessLabel = {
  public: "Public",
  friends: "Friends only",
  invite: "Invite only",
} as const

export const roomEndMessage: Record<RoomEndReason, string> = {
  removed: "The host removed you from this room.",
  banned: "You can't rejoin this room.",
  left: "You left this room.",
  deleted: "This room was deleted.",
  expired:
    "Your guest access has expired. Create an account to keep joining rooms.",
  access: "You no longer have access to this room.",
  signed_out: "You were signed out.",
}

const inviteLinkStorageKey = (roomId: string) => `kaiser.roomInvite.${roomId}`

// Only token hashes are stored server-side, so the host's browser keeps the
// plain link it created to copy it again later.
export const storedInviteLink = {
  read: (roomId: string) => {
    try {
      const raw = window.localStorage.getItem(inviteLinkStorageKey(roomId))
      if (!raw) return null
      const value = JSON.parse(raw) as { token: string; expiresAt: number }
      return value.expiresAt > Date.now() ? value : null
    } catch {
      return null
    }
  },
  write: (roomId: string, value: { token: string; expiresAt: number }) => {
    try {
      window.localStorage.setItem(
        inviteLinkStorageKey(roomId),
        JSON.stringify(value)
      )
    } catch {}
  },
  clear: (roomId: string) => {
    try {
      window.localStorage.removeItem(inviteLinkStorageKey(roomId))
    } catch {}
  },
}

export const inviteUrl = (roomId: string, token: string) =>
  `${window.location.origin}/rooms/${roomId}#invite=${encodeURIComponent(token)}`
