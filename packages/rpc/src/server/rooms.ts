import type { KaiserAuth } from "@animekaiser/auth/server"
import { AuthServer } from "@animekaiser/auth/server"
import { RoomService, roomGuestCookiePrefix } from "@animekaiser/core"
import type { RoomActorShape } from "@animekaiser/domain"
import {
  CurrentUser,
  RoomActor,
  RoomAuthentication,
  RoomRpcs,
} from "@animekaiser/domain"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import * as Cookies from "effect/http/Cookies"
import type * as Headers from "effect/http/Headers"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"

const readSessionOrNull = (auth: KaiserAuth, headers: Headers.Headers) =>
  Effect.tryPromise(() =>
    auth.api.getSession({ headers: new globalThis.Headers(headers) })
  ).pipe(Effect.orElseSucceed(() => undefined))

export const RoomAuthenticationLive = Layer.effect(
  RoomAuthentication,
  Effect.gen(function* () {
    const auth = yield* AuthServer
    return RoomAuthentication.of((effect, { headers }) =>
      Effect.gen(function* () {
        const session = yield* readSessionOrNull(auth, headers)
        const cookies = Cookies.parseHeader(headers.cookie ?? "")
        const guestTokens = Object.entries(cookies)
          .filter(([name]) => name.startsWith(roomGuestCookiePrefix))
          .map(([, value]) => value)
          .slice(0, 20)
        const userId = session?.user.id ?? null
        const actor: RoomActorShape = {
          user: session
            ? {
                id: session.user.id,
                name:
                  session.user.displayUsername ??
                  session.user.username ??
                  session.user.name,
                image: session.user.image ?? null,
              }
            : null,
          guestTokens,
          // A transient auth lookup failure must not eject a viewer; only a
          // definite missing or different session ends the room stream.
          sessionActive: userId
            ? readSessionOrNull(auth, headers).pipe(
                Effect.map((next) =>
                  next === undefined ? true : next?.user.id === userId
                )
              )
            : Effect.succeed(true),
        }
        return yield* Effect.provideService(effect, RoomActor, actor)
      })
    )
  })
)

const accountActor = (user: { id: string; image: string | null }) =>
  ({
    user: { id: user.id, name: "", image: user.image },
    guestTokens: [],
    sessionActive: Effect.succeed(true),
  }) satisfies RoomActorShape

export const RoomHandlersLive = RoomRpcs.toLayer(
  Effect.gen(function* () {
    const rooms = yield* RoomService
    const withActor = <A, E>(
      run: (actor: RoomActorShape) => Effect.Effect<A, E>
    ) => Effect.flatMap(RoomActor, run)
    return RoomRpcs.of({
      CreateRoom: (input) =>
        Effect.flatMap(CurrentUser, (user) => rooms.create(user.id, input)),
      ListRooms: ({ tab }) =>
        Effect.flatMap(CurrentUser, (user) => rooms.list(user.id, tab)),
      InviteToRoom: ({ roomId, userIds }) =>
        Effect.flatMap(CurrentUser, (user) =>
          rooms.invite(accountActor(user), roomId, userIds)
        ),
      DeclineRoomInvitation: ({ roomId }) =>
        Effect.flatMap(CurrentUser, (user) =>
          rooms.declineInvitation(user.id, roomId)
        ),
      TransferRoomHost: ({ roomId, participantId }) =>
        Effect.flatMap(CurrentUser, (user) =>
          rooms.transferHost(accountActor(user), roomId, participantId)
        ),
      SetRoomTasteSharing: ({ roomId, share }) =>
        Effect.flatMap(CurrentUser, (user) =>
          rooms.setTasteSharing(user.id, roomId, share)
        ),
      RecordRoomViewing: (input) =>
        Effect.flatMap(CurrentUser, (user) =>
          rooms.recordViewing(user.id, input)
        ),
      GetRoomAdmission: ({ roomId, inviteToken }) =>
        withActor((actor) => rooms.admission(actor, roomId, inviteToken)),
      JoinRoom: ({ roomId, inviteToken }) =>
        withActor((actor) => rooms.join(actor, roomId, inviteToken)),
      WatchRoom: ({ roomId, connectionId }) =>
        Stream.unwrap(
          Effect.map(RoomActor, (actor) =>
            rooms.watch(actor, roomId, connectionId)
          )
        ),
      GetRoomClock: () =>
        Effect.map(Clock.currentTimeMillis, (serverTime) => ({ serverTime })),
      ListRoomMessages: ({ roomId, beforeSeq }) =>
        withActor((actor) => rooms.listMessages(actor, roomId, beforeSeq)),
      SendRoomMessage: ({ roomId, requestId, body }) =>
        withActor((actor) => rooms.sendMessage(actor, roomId, requestId, body)),
      DeleteRoomMessage: ({ roomId, messageId }) =>
        withActor((actor) => rooms.deleteMessage(actor, roomId, messageId)),
      CommandRoomPlayback: ({ roomId, selectionRevision, action }) =>
        withActor((actor) =>
          rooms.command(actor, roomId, selectionRevision, action)
        ),
      SelectRoomEpisode: ({ roomId, selection, play }) =>
        withActor((actor) =>
          rooms.selectEpisode(actor, roomId, selection, play)
        ),
      ClaimRoomPlayback: ({ roomId, connectionId }) =>
        withActor((actor) => rooms.claimPlayback(actor, roomId, connectionId)),
      ReportRoomPlaybackState: ({ roomId, connectionId, state }) =>
        withActor((actor) =>
          rooms.reportPlaybackState(actor, roomId, connectionId, state)
        ),
      UpdateRoomSettings: ({ roomId, ...settings }) =>
        withActor((actor) => rooms.updateSettings(actor, roomId, settings)),
      PreviewRoomAccessChange: ({ roomId, access }) =>
        withActor((actor) => rooms.previewAccessChange(actor, roomId, access)),
      CreateRoomInviteLink: ({ roomId }) =>
        withActor((actor) => rooms.createInviteLink(actor, roomId)),
      RevokeRoomInviteLinks: ({ roomId }) =>
        withActor((actor) => rooms.revokeInviteLinks(actor, roomId)),
      RemoveRoomParticipant: ({ roomId, participantId, ban }) =>
        withActor((actor) =>
          rooms.removeParticipant(actor, roomId, participantId, ban)
        ),
      LeaveRoom: ({ roomId }) =>
        withActor((actor) => rooms.leave(actor, roomId)),
      CloseRoom: ({ roomId, delete: remove }) =>
        withActor((actor) => rooms.close(actor, roomId, remove)),
      AddRoomPick: ({ roomId, anime }) =>
        withActor((actor) => rooms.addPick(actor, roomId, anime)),
      RemoveRoomPick: ({ roomId, pickId }) =>
        withActor((actor) => rooms.removePick(actor, roomId, pickId)),
      ToggleRoomVote: ({ roomId, pickId, vote }) =>
        withActor((actor) => rooms.vote(actor, roomId, pickId, vote)),
      ConvertRoomGuest: ({ roomId }) =>
        withActor((actor) => rooms.convertGuest(actor, roomId)),
    })
  })
)
