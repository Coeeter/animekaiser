import type {
  AnimeDetail,
  StreamAudio,
  StreamEpisodeNotFoundError,
  StreamingUnavailableError,
  StreamPlayback,
  StreamProvider,
  StreamProviderEpisodes,
  StreamProviderId,
  StreamProviderNotFoundError,
  StreamProviderUnavailableError,
} from "@animekaiser/domain"
import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"

export type StreamPlaybackFailure =
  | StreamingUnavailableError
  | StreamProviderNotFoundError
  | StreamProviderUnavailableError
  | StreamEpisodeNotFoundError

export class StreamingClient extends Context.Tag(
  "@animekaiser/core/StreamingClient"
)<
  StreamingClient,
  {
    listProviders: Effect.Effect<
      ReadonlyArray<StreamProvider>,
      StreamingUnavailableError
    >
    listEpisodes: (
      anime: AnimeDetail,
      provider: StreamProviderId,
      providerAnimeId?: string
    ) => Effect.Effect<StreamProviderEpisodes, StreamingUnavailableError>
    getPlayback: (
      anime: AnimeDetail,
      provider: StreamProviderId,
      episodeId: string,
      audio: StreamAudio,
      serverId?: string,
      providerAnimeId?: string
    ) => Effect.Effect<StreamPlayback, StreamPlaybackFailure>
  }
>() {}
