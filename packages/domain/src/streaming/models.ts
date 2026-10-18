import * as Schema from "effect/Schema"
import { AnimeDetail, MalId } from "../anime/models"

export const StreamProviderId = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.brand("StreamProviderId")
)
export type StreamProviderId = typeof StreamProviderId.Type

export const StreamProvider = Schema.Struct({
  id: StreamProviderId,
  label: Schema.NonEmptyString,
})
export type StreamProvider = typeof StreamProvider.Type

export const StreamAudio = Schema.Literals(["sub", "dub"])
export type StreamAudio = typeof StreamAudio.Type

export const StreamServer = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  audio: StreamAudio,
  isDefault: Schema.optional(Schema.Boolean),
})
export type StreamServer = typeof StreamServer.Type

export const StreamEpisode = Schema.Struct({
  id: Schema.NonEmptyString,
  number: Schema.Finite.check(Schema.isGreaterThan(0)),
  title: Schema.NonEmptyString,
  japaneseTitle: Schema.NullOr(Schema.String),
  availableAudio: Schema.Array(StreamAudio),
  updatedAt: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
})
export type StreamEpisode = typeof StreamEpisode.Type

export const StreamProviderEpisodes = Schema.Struct({
  provider: StreamProviderId,
  label: Schema.NonEmptyString,
  providerAnimeId: Schema.NullOr(Schema.String),
  matchedTitle: Schema.NullOr(Schema.String),
  status: Schema.Literals(["available", "unmatched", "unavailable"]),
  message: Schema.NullOr(Schema.String),
  episodes: Schema.Array(StreamEpisode),
})
export type StreamProviderEpisodes = typeof StreamProviderEpisodes.Type

export const StreamProviderAvailability = Schema.Struct({
  provider: StreamProviderId,
  label: Schema.NonEmptyString,
  status: Schema.Literals(["available", "unmatched", "unavailable"]),
  sub: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  dub: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
})
export type StreamProviderAvailability = typeof StreamProviderAvailability.Type

export const StreamEpisodeCatalog = Schema.Struct({
  anime: AnimeDetail,
  providers: Schema.Array(StreamProviderEpisodes),
})
export type StreamEpisodeCatalog = typeof StreamEpisodeCatalog.Type

export const StreamTrack = Schema.Struct({
  file: Schema.NonEmptyString,
  label: Schema.NonEmptyString,
  kind: Schema.NonEmptyString,
  default: Schema.Boolean,
})
export type StreamTrack = typeof StreamTrack.Type

export const StreamSkipSegment = Schema.Struct({
  start: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  end: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
})
export type StreamSkipSegment = typeof StreamSkipSegment.Type

export const StreamPlayback = Schema.Struct({
  anime: AnimeDetail,
  provider: StreamProviderId,
  providerAnimeId: Schema.NonEmptyString,
  episode: StreamEpisode,
  audio: StreamAudio,
  server: StreamServer,
  servers: Schema.Array(StreamServer),
  sourceUrl: Schema.NonEmptyString,
  tracks: Schema.Array(StreamTrack),
  expiresAt: Schema.Int.check(Schema.isGreaterThan(0)),
  intro: Schema.NullOr(StreamSkipSegment),
  outro: Schema.NullOr(StreamSkipSegment),
  thumbnails: Schema.NullOr(Schema.String),
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

export class StreamProviderUnavailableError extends Schema.TaggedError<StreamProviderUnavailableError>()(
  "StreamProviderUnavailableError",
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
