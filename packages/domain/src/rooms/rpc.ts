import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import { Rpc, RpcGroup } from "effect/rpc"
import * as RpcMiddleware from "effect/rpc/RpcMiddleware"
import * as Schema from "effect/Schema"
import { Authentication } from "../auth/rpc"
import { AnimeLibraryMetadata } from "../library/models"
import {
  RoomAccess,
  RoomAccessChangePreview,
  RoomAdmission,
  RoomAiAccess,
  RoomEpisodeSelection,
  RoomEvent,
  RoomId,
  RoomInviteLink,
  RoomListTab,
  RoomMessage,
  RoomName,
  RoomOperationError,
  RoomPlaybackAction,
  RoomPlaybackControl,
  RoomPlaybackState,
  RoomSummary,
  RoomViewingResult,
} from "./models"

export type RoomActorShape = {
  readonly user: {
    readonly id: string
    readonly name: string
    readonly image: string | null
  } | null
  readonly guestTokens: ReadonlyArray<string>
  readonly sessionActive: Effect.Effect<boolean>
}

// Either a signed-in account, room-scoped guest credentials, or both while a
// guest is upgrading. It never satisfies the account-only `CurrentUser`.
export class RoomActor extends Context.Service<RoomActor, RoomActorShape>()(
  "@animekaiser/domain/RoomActor"
) {}

export class RoomAuthentication extends RpcMiddleware.Service<
  RoomAuthentication,
  { provides: RoomActor }
>()("@animekaiser/domain/RoomAuthentication") {}

const RequestId = Schema.String.check(
  Schema.isMinLength(8),
  Schema.isMaxLength(64)
)
const ParticipantId = Schema.String.check(Schema.isUUID())
const ConnectionId = Schema.String.check(Schema.isUUID())

export class CreateRoom extends Rpc.make("CreateRoom", {
  payload: {
    name: RoomName,
    access: RoomAccess,
    playbackControl: RoomPlaybackControl,
    aiAccess: RoomAiAccess,
    selection: Schema.NullOr(
      Schema.Struct({
        ...RoomEpisodeSelection.fields,
        positionSeconds: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
      })
    ),
    roomId: RoomId,
  },
  success: Schema.Struct({ roomId: RoomId }),
  error: RoomOperationError,
}) {}

export class ListRooms extends Rpc.make("ListRooms", {
  payload: { tab: RoomListTab },
  success: Schema.Array(RoomSummary),
  error: RoomOperationError,
}) {}

export class InviteToRoom extends Rpc.make("InviteToRoom", {
  payload: {
    roomId: RoomId,
    userIds: Schema.Array(Schema.String).check(Schema.isMaxLength(20)),
  },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class DeclineRoomInvitation extends Rpc.make("DeclineRoomInvitation", {
  payload: { roomId: RoomId },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class TransferRoomHost extends Rpc.make("TransferRoomHost", {
  payload: { roomId: RoomId, participantId: ParticipantId },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class SetRoomTasteSharing extends Rpc.make("SetRoomTasteSharing", {
  payload: { roomId: RoomId, share: Schema.Boolean },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class RecordRoomViewing extends Rpc.make("RecordRoomViewing", {
  payload: {
    roomId: RoomId,
    anime: AnimeLibraryMetadata,
    provider: Schema.String,
    episodeId: Schema.String,
    serverId: Schema.NullOr(Schema.String),
    serverName: Schema.NullOr(Schema.String),
    episode: Schema.Int.check(Schema.isGreaterThan(0)),
    audio: Schema.Literals(["sub", "dub"]),
    positionSeconds: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
    durationSeconds: Schema.NullOr(
      Schema.Finite.check(Schema.isGreaterThan(0))
    ),
    segment: Schema.NullOr(
      Schema.Struct({
        fromSeconds: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
        toSeconds: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
        elapsedMs: Schema.Int.check(
          Schema.isBetween({ minimum: 0, maximum: 120_000 })
        ),
        rate: Schema.Finite.check(
          Schema.isBetween({ minimum: 0.25, maximum: 2 })
        ),
      })
    ),
  },
  success: RoomViewingResult,
  error: RoomOperationError,
}) {}

export class ConvertRoomGuest extends Rpc.make("ConvertRoomGuest", {
  payload: { roomId: RoomId },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

class AccountRoomRpcs extends RpcGroup.make(
  CreateRoom,
  ListRooms,
  InviteToRoom,
  DeclineRoomInvitation,
  TransferRoomHost,
  SetRoomTasteSharing,
  RecordRoomViewing
).middleware(Authentication) {}

export class GetRoomAdmission extends Rpc.make("GetRoomAdmission", {
  payload: {
    roomId: RoomId,
    inviteToken: Schema.optional(Schema.String.check(Schema.isMaxLength(200))),
  },
  success: RoomAdmission,
  error: RoomOperationError,
}) {}

export class JoinRoom extends Rpc.make("JoinRoom", {
  payload: {
    roomId: RoomId,
    inviteToken: Schema.optional(Schema.String.check(Schema.isMaxLength(200))),
  },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class WatchRoom extends Rpc.make("WatchRoom", {
  payload: { roomId: RoomId, connectionId: ConnectionId },
  success: RoomEvent,
  error: RoomOperationError,
  stream: true,
}) {}

export class GetRoomClock extends Rpc.make("GetRoomClock", {
  success: Schema.Struct({ serverTime: Schema.Finite }),
}) {}

export class ListRoomMessages extends Rpc.make("ListRoomMessages", {
  payload: {
    roomId: RoomId,
    beforeSeq: Schema.Int.check(Schema.isGreaterThan(0)),
  },
  success: Schema.Struct({
    messages: Schema.Array(RoomMessage),
    hasEarlier: Schema.Boolean,
  }),
  error: RoomOperationError,
}) {}

export class SendRoomMessage extends Rpc.make("SendRoomMessage", {
  payload: {
    roomId: RoomId,
    requestId: RequestId,
    body: Schema.NonEmptyString.check(Schema.isMaxLength(1000)),
  },
  success: RoomMessage,
  error: RoomOperationError,
}) {}

export class DeleteRoomMessage extends Rpc.make("DeleteRoomMessage", {
  payload: { roomId: RoomId, messageId: Schema.String },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class CommandRoomPlayback extends Rpc.make("CommandRoomPlayback", {
  payload: {
    roomId: RoomId,
    selectionRevision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    action: RoomPlaybackAction,
  },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class SelectRoomEpisode extends Rpc.make("SelectRoomEpisode", {
  payload: {
    roomId: RoomId,
    selection: Schema.NullOr(RoomEpisodeSelection),
    play: Schema.optional(Schema.Boolean),
  },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class ClaimRoomPlayback extends Rpc.make("ClaimRoomPlayback", {
  payload: { roomId: RoomId, connectionId: ConnectionId },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class ReportRoomPlaybackState extends Rpc.make(
  "ReportRoomPlaybackState",
  {
    payload: {
      roomId: RoomId,
      connectionId: ConnectionId,
      state: RoomPlaybackState,
    },
    success: Schema.Void,
    error: RoomOperationError,
  }
) {}

export class UpdateRoomSettings extends Rpc.make("UpdateRoomSettings", {
  payload: {
    roomId: RoomId,
    name: Schema.optional(RoomName),
    access: Schema.optional(RoomAccess),
    playbackControl: Schema.optional(RoomPlaybackControl),
    aiAccess: Schema.optional(RoomAiAccess),
  },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class PreviewRoomAccessChange extends Rpc.make(
  "PreviewRoomAccessChange",
  {
    payload: { roomId: RoomId, access: RoomAccess },
    success: RoomAccessChangePreview,
    error: RoomOperationError,
  }
) {}

export class CreateRoomInviteLink extends Rpc.make("CreateRoomInviteLink", {
  payload: { roomId: RoomId },
  success: RoomInviteLink,
  error: RoomOperationError,
}) {}

export class RevokeRoomInviteLinks extends Rpc.make("RevokeRoomInviteLinks", {
  payload: { roomId: RoomId },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class RemoveRoomParticipant extends Rpc.make("RemoveRoomParticipant", {
  payload: {
    roomId: RoomId,
    participantId: ParticipantId,
    ban: Schema.Boolean,
  },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class LeaveRoom extends Rpc.make("LeaveRoom", {
  payload: { roomId: RoomId },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class CloseRoom extends Rpc.make("CloseRoom", {
  payload: { roomId: RoomId, delete: Schema.Boolean },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class AddRoomPick extends Rpc.make("AddRoomPick", {
  payload: { roomId: RoomId, anime: AnimeLibraryMetadata },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class RemoveRoomPick extends Rpc.make("RemoveRoomPick", {
  payload: { roomId: RoomId, pickId: Schema.String.check(Schema.isUUID()) },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class ToggleRoomVote extends Rpc.make("ToggleRoomVote", {
  payload: {
    roomId: RoomId,
    pickId: Schema.String.check(Schema.isUUID()),
    vote: Schema.Boolean,
  },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

class ParticipantRoomRpcs extends RpcGroup.make(
  GetRoomAdmission,
  JoinRoom,
  WatchRoom,
  GetRoomClock,
  ListRoomMessages,
  SendRoomMessage,
  DeleteRoomMessage,
  CommandRoomPlayback,
  SelectRoomEpisode,
  ClaimRoomPlayback,
  ReportRoomPlaybackState,
  UpdateRoomSettings,
  PreviewRoomAccessChange,
  CreateRoomInviteLink,
  RevokeRoomInviteLinks,
  RemoveRoomParticipant,
  LeaveRoom,
  CloseRoom,
  AddRoomPick,
  RemoveRoomPick,
  ToggleRoomVote,
  ConvertRoomGuest
).middleware(RoomAuthentication) {}

export class RoomRpcs extends RpcGroup.make().merge(
  AccountRoomRpcs,
  ParticipantRoomRpcs
) {}
