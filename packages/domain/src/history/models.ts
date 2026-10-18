import * as Schema from "effect/Schema"
import { MalId } from "../anime/models"
import { AnimeLibraryMetadata } from "../library/models"
import { StreamAudio, StreamProviderId } from "../streaming/models"

export const WatchHistoryStatus = Schema.Literals(["watching", "completed"])
export type WatchHistoryStatus = typeof WatchHistoryStatus.Type

export const WatchHistoryEntry = Schema.Struct({
  malId: MalId,
  provider: StreamProviderId,
  episodeId: Schema.String,
  serverId: Schema.NullOr(Schema.String),
  serverName: Schema.NullOr(Schema.String),
  episode: Schema.Int.check(Schema.isGreaterThan(0)),
  audio: StreamAudio,
  positionSeconds: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  durationSeconds: Schema.NullOr(Schema.Int.check(Schema.isGreaterThan(0))),
  status: WatchHistoryStatus,
  updatedAt: Schema.DateFromString,
})
export type WatchHistoryEntry = typeof WatchHistoryEntry.Type

export const ContinueWatchingItem = Schema.Struct({
  ...WatchHistoryEntry.fields,
  anime: AnimeLibraryMetadata,
  episodeImage: Schema.NullOr(Schema.String),
})
export type ContinueWatchingItem = typeof ContinueWatchingItem.Type

export const WatchHistoryNext = Schema.Union([
  Schema.TaggedStruct("resume", {
    episode: Schema.Int.check(Schema.isGreaterThan(0)),
  }),
  Schema.TaggedStruct("next", {
    episode: Schema.Int.check(Schema.isGreaterThan(0)),
  }),
  Schema.TaggedStruct("caughtUp", {
    nextAiringAt: Schema.NullOr(Schema.DateFromString),
  }),
  Schema.TaggedStruct("completed", {}),
])
export type WatchHistoryNext = typeof WatchHistoryNext.Type

export const WatchHistoryShow = Schema.Struct({
  anime: AnimeLibraryMetadata,
  episodesWatched: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  latest: ContinueWatchingItem,
  episodes: Schema.Array(ContinueWatchingItem),
  next: WatchHistoryNext,
})
export type WatchHistoryShow = typeof WatchHistoryShow.Type

export class WatchHistoryOperationError extends Schema.TaggedError<WatchHistoryOperationError>()(
  "WatchHistoryOperationError",
  { message: Schema.String }
) {}
