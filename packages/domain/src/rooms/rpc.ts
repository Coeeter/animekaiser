import { Rpc, RpcGroup } from "@effect/rpc"
import * as RpcMiddleware from "@effect/rpc/RpcMiddleware"
import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
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
export class RoomActor extends Context.Tag("@animekaiser/domain/RoomActor")<
  RoomActor,
  RoomActorShape
>() {}

export class RoomAuthentication extends RpcMiddleware.Tag<RoomAuthentication>()(
  "@animekaiser/domain/RoomAuthentication",
  { provides: RoomActor }
) {}

const RequestId = Schema.String.pipe(Schema.minLength(8), Schema.maxLength(64))
const ParticipantId = Schema.UUID
const ConnectionId = Schema.UUID

export class CreateRoom extends Rpc.make("CreateRoom", {
  payload: {
    name: RoomName,
    access: RoomAccess,
    playbackControl: RoomPlaybackControl,
    aiAccess: RoomAiAccess,
    selection: Schema.NullOr(
      Schema.Struct({
        ...RoomEpisodeSelection.fields,
        positionSeconds: Schema.NonNegative,
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
    userIds: Schema.Array(Schema.String).pipe(Schema.maxItems(20)),
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
    episode: Schema.Int.pipe(Schema.positive()),
    audio: Schema.Literal("sub", "dub"),
    positionSeconds: Schema.NonNegative,
    durationSeconds: Schema.NullOr(Schema.Number.pipe(Schema.positive())),
    segment: Schema.NullOr(
      Schema.Struct({
        fromSeconds: Schema.NonNegative,
        toSeconds: Schema.NonNegative,
        elapsedMs: Schema.Int.pipe(Schema.between(0, 120_000)),
        rate: Schema.Number.pipe(Schema.between(0.25, 2)),
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
    inviteToken: Schema.optional(Schema.String.pipe(Schema.maxLength(200))),
  },
  success: RoomAdmission,
  error: RoomOperationError,
}) {}

export class JoinRoom extends Rpc.make("JoinRoom", {
  payload: {
    roomId: RoomId,
    inviteToken: Schema.optional(Schema.String.pipe(Schema.maxLength(200))),
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
  success: Schema.Struct({ serverTime: Schema.Number }),
}) {}

export class ListRoomMessages extends Rpc.make("ListRoomMessages", {
  payload: { roomId: RoomId, beforeSeq: Schema.Int.pipe(Schema.positive()) },
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
    body: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(1000)),
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
    selectionRevision: Schema.NonNegativeInt,
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
  payload: { roomId: RoomId, pickId: Schema.UUID },
  success: Schema.Void,
  error: RoomOperationError,
}) {}

export class ToggleRoomVote extends Rpc.make("ToggleRoomVote", {
  payload: { roomId: RoomId, pickId: Schema.UUID, vote: Schema.Boolean },
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
