import { Rpc, RpcGroup } from "effect/rpc"
import * as Schema from "effect/Schema"
import { MalId } from "../anime/models"
import { Authentication } from "../auth/rpc"
import { AnimeLibraryMetadata } from "../library/models"
import { StreamAudio, StreamProviderId } from "../streaming/models"
import {
  ContinueWatchingItem,
  WatchHistoryEntry,
  WatchHistoryOperationError,
  WatchHistoryShow,
} from "./models"

export class RecordWatchProgress extends Rpc.make("RecordWatchProgress", {
  payload: {
    anime: AnimeLibraryMetadata,
    provider: StreamProviderId,
    episodeId: Schema.NonEmptyString,
    serverId: Schema.NullOr(Schema.String),
    serverName: Schema.NullOr(Schema.String),
    episode: Schema.Int.check(Schema.isGreaterThan(0)),
    audio: StreamAudio,
    positionSeconds: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    durationSeconds: Schema.NullOr(Schema.Int.check(Schema.isGreaterThan(0))),
  },
  success: WatchHistoryEntry,
  error: WatchHistoryOperationError,
}) {}

export class ListContinueWatching extends Rpc.make("ListContinueWatching", {
  payload: {
    limit: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 50 })),
  },
  success: Schema.Array(ContinueWatchingItem),
  error: WatchHistoryOperationError,
}) {}

export class ListWatchHistory extends Rpc.make("ListWatchHistory", {
  payload: {
    page: Schema.Int.check(Schema.isGreaterThan(0)),
    perPage: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
    query: Schema.optional(Schema.String.check(Schema.isMaxLength(200))),
  },
  success: Schema.Struct({
    items: Schema.Array(ContinueWatchingItem),
    hasNextPage: Schema.Boolean,
  }),
  error: WatchHistoryOperationError,
}) {}

export class ListWatchHistoryShows extends Rpc.make("ListWatchHistoryShows", {
  payload: {
    page: Schema.Int.check(Schema.isGreaterThan(0)),
    perPage: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 50 })),
    query: Schema.optional(Schema.String.check(Schema.isMaxLength(200))),
  },
  success: Schema.Struct({
    items: Schema.Array(WatchHistoryShow),
    hasNextPage: Schema.Boolean,
  }),
  error: WatchHistoryOperationError,
}) {}

export class GetEpisodeWatchProgress extends Rpc.make(
  "GetEpisodeWatchProgress",
  {
    payload: {
      malId: MalId,
      episode: Schema.Int.check(Schema.isGreaterThan(0)),
    },
    success: Schema.NullOr(WatchHistoryEntry),
    error: WatchHistoryOperationError,
  }
) {}

export class ListAnimeWatchProgress extends Rpc.make("ListAnimeWatchProgress", {
  payload: { malId: MalId },
  success: Schema.Array(WatchHistoryEntry),
  error: WatchHistoryOperationError,
}) {}

export class ClearWatchHistoryEntry extends Rpc.make("ClearWatchHistoryEntry", {
  payload: { malId: MalId },
  success: Schema.Void,
  error: WatchHistoryOperationError,
}) {}

export class ClearWatchHistory extends Rpc.make("ClearWatchHistory", {
  success: Schema.Void,
  error: WatchHistoryOperationError,
}) {}

export class WatchHistoryRpcs extends RpcGroup.make(
  RecordWatchProgress,
  ListContinueWatching,
  ListWatchHistory,
  ListWatchHistoryShows,
  GetEpisodeWatchProgress,
  ListAnimeWatchProgress,
  ClearWatchHistoryEntry,
  ClearWatchHistory
).middleware(Authentication) {}
