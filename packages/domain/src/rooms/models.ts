import * as Schema from "effect/Schema"
import { AnimeLibraryMetadata } from "../library/models"
import { StreamAudio, StreamProviderId } from "../streaming/models"

export const RoomId = Schema.String.check(Schema.isUUID())
export type RoomId = typeof RoomId.Type

export const RoomCapacity = 20

export const RoomAccess = Schema.Literals(["public", "friends", "invite"])
export type RoomAccess = typeof RoomAccess.Type

export const RoomAiAccess = Schema.Literals(["off", "host", "everyone"])
export type RoomAiAccess = typeof RoomAiAccess.Type

export const RoomName = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(1),
  Schema.isMaxLength(60)
)

export const GuestDisplayName = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(1),
  Schema.isMaxLength(32),
  Schema.isPattern(/^[^\p{C}<>]+$/u)
)

export const RoomEpisodeSelection = Schema.Struct({
  anime: AnimeLibraryMetadata,
  provider: StreamProviderId,
  episodeId: Schema.NonEmptyString.check(Schema.isMaxLength(500)),
  episodeNumber: Schema.Finite.check(Schema.isGreaterThan(0)),
  audio: StreamAudio,
})
export type RoomEpisodeSelection = typeof RoomEpisodeSelection.Type

export const RoomSelection = Schema.Struct({
  ...RoomEpisodeSelection.fields,
  revision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
})
export type RoomSelection = typeof RoomSelection.Type

// `positionSeconds` was the timeline position at server time `positionAt`
// (epoch ms); while playing it advances at `rate` from that anchor.
export const RoomPlayback = Schema.Struct({
  playing: Schema.Boolean,
  positionSeconds: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  positionAt: Schema.Finite,
  rate: Schema.Finite.check(Schema.isBetween({ minimum: 0.25, maximum: 2 })),
})
export type RoomPlayback = typeof RoomPlayback.Type

export const RoomPlaybackState = Schema.Literals([
  "idle",
  "ready",
  "buffering",
  "blocked",
  "error",
])
export type RoomPlaybackState = typeof RoomPlaybackState.Type

export const RoomParticipantKind = Schema.Literals(["account", "guest"])

export const RoomMember = Schema.Struct({
  id: Schema.String,
  kind: RoomParticipantKind,
  displayName: Schema.String,
  username: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
  isHost: Schema.Boolean,
  online: Schema.Boolean,
  playbackState: RoomPlaybackState,
  guestExpiresAt: Schema.NullOr(Schema.Finite),
})
export type RoomMember = typeof RoomMember.Type

export const RoomPick = Schema.Struct({
  id: Schema.String,
  anime: AnimeLibraryMetadata,
  addedBy: Schema.NullOr(Schema.String),
  votes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  votedByYou: Schema.Boolean,
  createdAt: Schema.Finite,
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
  guestExpiresAt: Schema.NullOr(Schema.Finite),
})
export type RoomViewer = typeof RoomViewer.Type

export const RoomStatus = Schema.Literals(["open", "closed"])

export const RoomState = Schema.Struct({
  id: RoomId,
  name: Schema.String,
  access: RoomAccess,
  aiAccess: RoomAiAccess,
  status: RoomStatus,
  revision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  hostName: Schema.NullOr(Schema.String),
  hostOnline: Schema.Boolean,
  hostAwaySince: Schema.NullOr(Schema.Finite),
  selection: Schema.NullOr(RoomSelection),
  playback: RoomPlayback,
  members: Schema.Array(RoomMember),
  picks: Schema.Array(RoomPick),
  you: RoomViewer,
  closedAt: Schema.NullOr(Schema.Finite),
  aiPendingBy: Schema.NullOr(Schema.String),
  aiResponse: Schema.NullOr(
    Schema.Struct({
      id: Schema.String,
      participantId: Schema.String,
      text: Schema.String,
      activity: Schema.NullOr(Schema.String),
    })
  ),
  serverTime: Schema.Finite,
})
export type RoomState = typeof RoomState.Type

export const RoomMessageKind = Schema.Literals([
  "text",
  "system",
  "ai",
  "recommendation",
  "recap",
])
export type RoomMessageKind = typeof RoomMessageKind.Type

export const RoomMessage = Schema.Struct({
  id: Schema.String,
  seq: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  participantId: Schema.NullOr(Schema.String),
  authorName: Schema.String,
  authorKind: Schema.Literals(["account", "guest", "deleted", "system", "ai"]),
  kind: RoomMessageKind,
  body: Schema.String,
  data: Schema.NullOr(Schema.Unknown),
  deleted: Schema.Boolean,
  createdAt: Schema.Finite,
})
export type RoomMessage = typeof RoomMessage.Type

export const RoomEndReason = Schema.Literals([
  "removed",
  "banned",
  "left",
  "deleted",
  "expired",
  "access",
  "signed_out",
])
export type RoomEndReason = typeof RoomEndReason.Type

export const RoomEvent = Schema.Union([
  Schema.TaggedStruct("State", { state: RoomState }),
  Schema.TaggedStruct("Messages", {
    messages: Schema.Array(RoomMessage),
    hasEarlier: Schema.Boolean,
  }),
  Schema.TaggedStruct("Ended", { reason: RoomEndReason }),
])
export type RoomEvent = typeof RoomEvent.Type

export const RoomSummary = Schema.Struct({
  id: RoomId,
  name: Schema.String,
  access: RoomAccess,
  status: RoomStatus,
  hostName: Schema.NullOr(Schema.String),
  anime: Schema.NullOr(AnimeLibraryMetadata),
  episodeNumber: Schema.NullOr(Schema.Finite),
  onlineCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  capacity: Schema.Int,
  isHost: Schema.Boolean,
  membership: Schema.Literals(["member", "invited", "none"]),
  updatedAt: Schema.Finite,
})
export type RoomSummary = typeof RoomSummary.Type

export const RoomListTab = Schema.Literals([
  "mine",
  "friends",
  "invitations",
  "public",
])
export type RoomListTab = typeof RoomListTab.Type

export const RoomAdmissionStatus = Schema.Literals([
  "member",
  "joinable",
  "sign_in_required",
  "invite_required",
  "friends_only",
  "full",
  "banned",
  "closed",
  "unavailable",
])
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
      episodeNumber: Schema.NullOr(Schema.Finite),
      onlineCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
      capacity: Schema.Int,
    })
  ),
})
export type RoomAdmission = typeof RoomAdmission.Type

export const RoomPlaybackAction = Schema.Union([
  Schema.TaggedStruct("Play", {
    positionSeconds: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
  Schema.TaggedStruct("Pause", {
    positionSeconds: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
  Schema.TaggedStruct("Seek", {
    positionSeconds: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
  Schema.TaggedStruct("Rate", {
    positionSeconds: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
    rate: Schema.Finite.check(Schema.isBetween({ minimum: 0.25, maximum: 2 })),
  }),
])
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
  expiresAt: Schema.Finite,
})
export type RoomInviteLink = typeof RoomInviteLink.Type

export const RoomViewingResult = Schema.Struct({
  coveredSeconds: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  completed: Schema.Boolean,
  newlyCompleted: Schema.Boolean,
})
export type RoomViewingResult = typeof RoomViewingResult.Type

export const RoomErrorReason = Schema.Literals([
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
  "failed",
])
export type RoomErrorReason = typeof RoomErrorReason.Type

export class RoomOperationError extends Schema.TaggedError<RoomOperationError>()(
  "RoomOperationError",
  { reason: RoomErrorReason, message: Schema.String }
) {}
