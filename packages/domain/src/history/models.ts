import * as Schema from "effect/Schema"
import { MalId } from "../anime/models"
import { AnimeLibraryMetadata } from "../library/models"
import { StreamAudio, StreamProviderId } from "../streaming/models"

export const WatchHistoryStatus = Schema.Literal("watching", "completed")
export type WatchHistoryStatus = typeof WatchHistoryStatus.Type

export const WatchHistoryEntry = Schema.Struct({
  malId: MalId,
  provider: StreamProviderId,
  episodeId: Schema.String,
  serverId: Schema.NullOr(Schema.String),
  serverName: Schema.NullOr(Schema.String),
  episode: Schema.Int.pipe(Schema.positive()),
  audio: StreamAudio,
  positionSeconds: Schema.NonNegativeInt,
  durationSeconds: Schema.NullOr(Schema.Int.pipe(Schema.positive())),
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

export const WatchHistoryNext = Schema.Union(
  Schema.TaggedStruct("resume", {
    episode: Schema.Int.pipe(Schema.positive()),
  }),
  Schema.TaggedStruct("next", { episode: Schema.Int.pipe(Schema.positive()) }),
  Schema.TaggedStruct("caughtUp", {
    nextAiringAt: Schema.NullOr(Schema.DateFromString),
  }),
  Schema.TaggedStruct("completed", {})
)
export type WatchHistoryNext = typeof WatchHistoryNext.Type

export const WatchHistoryShow = Schema.Struct({
  anime: AnimeLibraryMetadata,
  episodesWatched: Schema.NonNegativeInt,
  latest: ContinueWatchingItem,
  episodes: Schema.Array(ContinueWatchingItem),
  next: WatchHistoryNext,
})
export type WatchHistoryShow = typeof WatchHistoryShow.Type

export class WatchHistoryOperationError extends Schema.TaggedError<WatchHistoryOperationError>()(
  "WatchHistoryOperationError",
  { message: Schema.String }
) {}
