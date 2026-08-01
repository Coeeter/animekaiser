import { Rpc, RpcGroup } from "@effect/rpc"
import * as Schema from "effect/Schema"
import { MalId } from "../anime/models"
import { Authentication } from "../auth/rpc"
import { AnimeLibraryMetadata } from "../library/models"
import { StreamAudio, StreamProviderId } from "../streaming/models"
import {
  ContinueWatchingItem,
  WatchHistoryEntry,
  WatchHistoryOperationError,
} from "./models"

export class RecordWatchProgress extends Rpc.make("RecordWatchProgress", {
  payload: {
    anime: AnimeLibraryMetadata,
    provider: StreamProviderId,
    episodeId: Schema.String.pipe(Schema.minLength(1)),
    serverId: Schema.NullOr(Schema.String),
    serverName: Schema.NullOr(Schema.String),
    episode: Schema.Int.pipe(Schema.positive()),
    audio: StreamAudio,
    positionSeconds: Schema.NonNegativeInt,
    durationSeconds: Schema.NullOr(Schema.Int.pipe(Schema.positive())),
  },
  success: WatchHistoryEntry,
  error: WatchHistoryOperationError,
}) {}

export class ListContinueWatching extends Rpc.make("ListContinueWatching", {
  payload: { limit: Schema.Int.pipe(Schema.between(1, 50)) },
  success: Schema.Array(ContinueWatchingItem),
  error: WatchHistoryOperationError,
}) {}

export class ListWatchHistory extends Rpc.make("ListWatchHistory", {
  payload: {
    page: Schema.Int.pipe(Schema.positive()),
    perPage: Schema.Int.pipe(Schema.between(1, 100)),
    query: Schema.optional(Schema.String.pipe(Schema.maxLength(200))),
  },
  success: Schema.Struct({
    items: Schema.Array(ContinueWatchingItem),
    hasNextPage: Schema.Boolean,
  }),
  error: WatchHistoryOperationError,
}) {}

export class GetEpisodeWatchProgress extends Rpc.make(
  "GetEpisodeWatchProgress",
  {
    payload: {
      malId: MalId,
      episode: Schema.Int.pipe(Schema.positive()),
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
  GetEpisodeWatchProgress,
  ListAnimeWatchProgress,
  ClearWatchHistoryEntry,
  ClearWatchHistory
).middleware(Authentication) {}
