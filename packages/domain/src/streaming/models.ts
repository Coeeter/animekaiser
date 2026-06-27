import * as Schema from "effect/Schema"
import { AnimeDetail, MalId } from "../anime/models"

export const StreamProviderId = Schema.Literal("provider-a")
export type StreamProviderId = typeof StreamProviderId.Type

export const StreamAudio = Schema.Literal("sub", "dub")
export type StreamAudio = typeof StreamAudio.Type

export const StreamEpisode = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
  number: Schema.Number.pipe(Schema.positive()),
  title: Schema.String.pipe(Schema.minLength(1)),
  japaneseTitle: Schema.NullOr(Schema.String),
  availableAudio: Schema.Array(StreamAudio),
  updatedAt: Schema.NullOr(Schema.String),
})
export type StreamEpisode = typeof StreamEpisode.Type

export const StreamProviderEpisodes = Schema.Struct({
  provider: StreamProviderId,
  providerAnimeId: Schema.NullOr(Schema.String),
  status: Schema.Literal("available", "unmatched", "unavailable"),
  message: Schema.NullOr(Schema.String),
  episodes: Schema.Array(StreamEpisode),
})
export type StreamProviderEpisodes = typeof StreamProviderEpisodes.Type

export const StreamEpisodeCatalog = Schema.Struct({
  anime: AnimeDetail,
  providers: Schema.Array(StreamProviderEpisodes),
})
export type StreamEpisodeCatalog = typeof StreamEpisodeCatalog.Type

export const StreamTrack = Schema.Struct({
  file: Schema.String.pipe(Schema.minLength(1)),
  label: Schema.String.pipe(Schema.minLength(1)),
  kind: Schema.String.pipe(Schema.minLength(1)),
  default: Schema.Boolean,
})
export type StreamTrack = typeof StreamTrack.Type

export const StreamThumbnailTrack = Schema.Struct({
  file: Schema.String.pipe(Schema.minLength(1)),
  label: Schema.String.pipe(Schema.minLength(1)),
})
export type StreamThumbnailTrack = typeof StreamThumbnailTrack.Type

export const StreamSkipSegment = Schema.Struct({
  start: Schema.Number.pipe(Schema.nonNegative()),
  end: Schema.Number.pipe(Schema.nonNegative()),
})
export type StreamSkipSegment = typeof StreamSkipSegment.Type

export const StreamPlayback = Schema.Struct({
  anime: AnimeDetail,
  provider: StreamProviderId,
  providerAnimeId: Schema.String.pipe(Schema.minLength(1)),
  episode: StreamEpisode,
  audio: StreamAudio,
  sourceUrl: Schema.String.pipe(Schema.minLength(1)),
  sourceRefererUrl: Schema.String.pipe(Schema.minLength(1)),
  iframeUrl: Schema.String.pipe(Schema.minLength(1)),
  tracks: Schema.Array(StreamTrack),
  thumbnails: Schema.Array(StreamThumbnailTrack),
  intro: Schema.NullOr(StreamSkipSegment),
  outro: Schema.NullOr(StreamSkipSegment),
})
export type StreamPlayback = typeof StreamPlayback.Type

export class StreamingUnavailableError extends Schema.TaggedError<StreamingUnavailableError>()(
  "StreamingUnavailableError",
  { message: Schema.String }
) {}

export class StreamProviderNotFoundError extends Schema.TaggedError<StreamProviderNotFoundError>()(
  "StreamProviderNotFoundError",
  {
    provider: StreamProviderId,
    malId: MalId,
    message: Schema.String,
  }
) {}

export class StreamEpisodeNotFoundError extends Schema.TaggedError<StreamEpisodeNotFoundError>()(
  "StreamEpisodeNotFoundError",
  {
    provider: StreamProviderId,
    malId: MalId,
    episodeId: Schema.String,
    message: Schema.String,
  }
) {}
