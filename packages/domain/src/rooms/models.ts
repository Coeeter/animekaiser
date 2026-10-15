import * as Schema from "effect/Schema"
import { AnimeLibraryMetadata } from "../library/models"
import { StreamAudio, StreamProviderId } from "../streaming/models"

export const RoomId = Schema.UUID
export type RoomId = typeof RoomId.Type

export const RoomCapacity = 20

export const RoomAccess = Schema.Literal("public", "friends", "invite")
export type RoomAccess = typeof RoomAccess.Type

export const RoomPlaybackControl = Schema.Literal("host", "everyone")
export type RoomPlaybackControl = typeof RoomPlaybackControl.Type

export const RoomAiAccess = Schema.Literal("off", "host", "everyone")
export type RoomAiAccess = typeof RoomAiAccess.Type

export const RoomName = Schema.String.pipe(
  Schema.trimmed(),
  Schema.minLength(1),
  Schema.maxLength(60)
)

export const GuestDisplayName = Schema.String.pipe(
  Schema.trimmed(),
  Schema.minLength(1),
  Schema.maxLength(32),
  Schema.pattern(/^[^\p{C}<>]+$/u)
)

export const RoomEpisodeSelection = Schema.Struct({
  anime: AnimeLibraryMetadata,
  provider: StreamProviderId,
  episodeId: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(500)),
  episodeNumber: Schema.Number.pipe(Schema.positive()),
  audio: StreamAudio,
})
export type RoomEpisodeSelection = typeof RoomEpisodeSelection.Type

export const RoomSelection = Schema.Struct({
  ...RoomEpisodeSelection.fields,
  revision: Schema.NonNegativeInt,
})
export type RoomSelection = typeof RoomSelection.Type

// `positionSeconds` was the timeline position at server time `positionAt`
// (epoch ms); while playing it advances at `rate` from that anchor.
export const RoomPlayback = Schema.Struct({
  playing: Schema.Boolean,
  positionSeconds: Schema.Number.pipe(Schema.nonNegative()),
  positionAt: Schema.Number,
  rate: Schema.Number.pipe(Schema.between(0.25, 2)),
})
export type RoomPlayback = typeof RoomPlayback.Type

export const RoomPlaybackState = Schema.Literal(
  "idle",
  "ready",
  "buffering",
  "blocked",
  "error"
)
export type RoomPlaybackState = typeof RoomPlaybackState.Type

export const RoomParticipantKind = Schema.Literal("account", "guest")

export const RoomMember = Schema.Struct({
  id: Schema.String,
  kind: RoomParticipantKind,
  displayName: Schema.String,
  username: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
  isHost: Schema.Boolean,
  online: Schema.Boolean,
  playbackState: RoomPlaybackState,
  guestExpiresAt: Schema.NullOr(Schema.Number),
})
export type RoomMember = typeof RoomMember.Type

export const RoomPick = Schema.Struct({
  id: Schema.String,
  anime: AnimeLibraryMetadata,
  addedBy: Schema.NullOr(Schema.String),
  votes: Schema.NonNegativeInt,
  votedByYou: Schema.Boolean,
  createdAt: Schema.Number,
})
export type RoomPick = typeof RoomPick.Type

export const RoomViewer = Schema.Struct({
  participantId: Schema.String,
  kind: RoomParticipantKind,
  isHost: Schema.Boolean,
  canControlPlayback: Schema.Boolean,
  canAskAi: Schema.Boolean,
  shareTaste: Schema.Boolean,
  controller: Schema.Boolean,
  guestExpiresAt: Schema.NullOr(Schema.Number),
})
export type RoomViewer = typeof RoomViewer.Type

export const RoomStatus = Schema.Literal("open", "closed")

export const RoomState = Schema.Struct({
  id: RoomId,
  name: Schema.String,
  access: RoomAccess,
  playbackControl: RoomPlaybackControl,
  aiAccess: RoomAiAccess,
  status: RoomStatus,
  revision: Schema.NonNegativeInt,
  hostName: Schema.NullOr(Schema.String),
  hostOnline: Schema.Boolean,
  hostAwaySince: Schema.NullOr(Schema.Number),
  selection: Schema.NullOr(RoomSelection),
  playback: RoomPlayback,
  members: Schema.Array(RoomMember),
  picks: Schema.Array(RoomPick),
  you: RoomViewer,
  closedAt: Schema.NullOr(Schema.Number),
  aiPendingBy: Schema.NullOr(Schema.String),
  serverTime: Schema.Number,
})
export type RoomState = typeof RoomState.Type

export const RoomMessageKind = Schema.Literal(
  "text",
  "system",
  "ai",
  "recommendation",
  "recap"
)
export type RoomMessageKind = typeof RoomMessageKind.Type

export const RoomMessage = Schema.Struct({
  id: Schema.String,
  seq: Schema.NonNegativeInt,
  participantId: Schema.NullOr(Schema.String),
  authorName: Schema.String,
  authorKind: Schema.Literal("account", "guest", "deleted", "system", "ai"),
  kind: RoomMessageKind,
  body: Schema.String,
  data: Schema.NullOr(Schema.Unknown),
  deleted: Schema.Boolean,
  createdAt: Schema.Number,
})
export type RoomMessage = typeof RoomMessage.Type

export const RoomEndReason = Schema.Literal(
  "removed",
  "banned",
  "left",
  "deleted",
  "expired",
  "access",
  "signed_out"
)
export type RoomEndReason = typeof RoomEndReason.Type

export const RoomEvent = Schema.Union(
  Schema.TaggedStruct("State", { state: RoomState }),
  Schema.TaggedStruct("Messages", {
    messages: Schema.Array(RoomMessage),
    hasEarlier: Schema.Boolean,
  }),
  Schema.TaggedStruct("Ended", { reason: RoomEndReason })
)
export type RoomEvent = typeof RoomEvent.Type

export const RoomSummary = Schema.Struct({
  id: RoomId,
  name: Schema.String,
  access: RoomAccess,
  status: RoomStatus,
  hostName: Schema.NullOr(Schema.String),
  anime: Schema.NullOr(AnimeLibraryMetadata),
  episodeNumber: Schema.NullOr(Schema.Number),
  onlineCount: Schema.NonNegativeInt,
  capacity: Schema.Int,
  isHost: Schema.Boolean,
  membership: Schema.Literal("member", "invited", "none"),
  updatedAt: Schema.Number,
})
export type RoomSummary = typeof RoomSummary.Type

export const RoomListTab = Schema.Literal(
  "mine",
  "friends",
  "invitations",
  "public"
)
export type RoomListTab = typeof RoomListTab.Type

export const RoomAdmissionStatus = Schema.Literal(
  "member",
  "joinable",
  "sign_in_required",
  "invite_required",
  "friends_only",
  "full",
  "banned",
  "closed",
  "unavailable"
)
export type RoomAdmissionStatus = typeof RoomAdmissionStatus.Type

// Unauthorized visitors only learn that the room is unavailable; room details
// are present only when the viewer is a member or could join right now.
export const RoomAdmission = Schema.Struct({
  status: RoomAdmissionStatus,
  guestAllowed: Schema.Boolean,
  room: Schema.NullOr(
    Schema.Struct({
      id: RoomId,
      name: Schema.String,
      access: RoomAccess,
      hostName: Schema.NullOr(Schema.String),
      anime: Schema.NullOr(AnimeLibraryMetadata),
      episodeNumber: Schema.NullOr(Schema.Number),
      onlineCount: Schema.NonNegativeInt,
      capacity: Schema.Int,
    })
  ),
})
export type RoomAdmission = typeof RoomAdmission.Type

export const RoomPlaybackAction = Schema.Union(
  Schema.TaggedStruct("Play", { positionSeconds: Schema.NonNegative }),
  Schema.TaggedStruct("Pause", { positionSeconds: Schema.NonNegative }),
  Schema.TaggedStruct("Seek", { positionSeconds: Schema.NonNegative }),
  Schema.TaggedStruct("Rate", {
    positionSeconds: Schema.NonNegative,
    rate: Schema.Number.pipe(Schema.between(0.25, 2)),
  })
)
export type RoomPlaybackAction = typeof RoomPlaybackAction.Type

export const RoomAccessChangePreview = Schema.Struct({
  removed: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String })
  ),
  broadens: Schema.Boolean,
})
export type RoomAccessChangePreview = typeof RoomAccessChangePreview.Type

export const RoomInviteLink = Schema.Struct({
  token: Schema.String,
  expiresAt: Schema.Number,
})
export type RoomInviteLink = typeof RoomInviteLink.Type

export const RoomViewingResult = Schema.Struct({
  coveredSeconds: Schema.NonNegative,
  completed: Schema.Boolean,
  newlyCompleted: Schema.Boolean,
})
export type RoomViewingResult = typeof RoomViewingResult.Type

export const RoomErrorReason = Schema.Literal(
  "unavailable",
  "sign_in_required",
  "not_member",
  "not_host",
  "cannot_control",
  "host_away",
  "stale",
  "closed",
  "full",
  "banned",
  "invite_required",
  "friends_only",
  "invalid",
  "rate_limited",
  "host_must_transfer",
  "failed"
)
export type RoomErrorReason = typeof RoomErrorReason.Type

export class RoomOperationError extends Schema.TaggedError<RoomOperationError>()(
  "RoomOperationError",
  { reason: RoomErrorReason, message: Schema.String }
) {}
