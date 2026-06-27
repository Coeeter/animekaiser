import type {
  AnimeNotFoundError,
  StreamAudio,
  StreamPlayback,
  StreamProviderId,
} from "@workspace/domain"
import {
  StreamEpisodeNotFoundError,
  StreamProviderNotFoundError,
  StreamingUnavailableError,
} from "@workspace/domain"
import * as Effect from "effect/Effect"
import { AnimeService } from "../anime"
import { ProviderAProvider } from "./provider-a"

export class StreamingService extends Effect.Service<StreamingService>()(
  "@workspace/core/StreamingService",
  {
    accessors: true,
    dependencies: [AnimeService.Default, ProviderAProvider.Default],
    effect: Effect.gen(function* () {
      const animeService = yield* AnimeService
      const aniKoto = yield* ProviderAProvider

      const getAnime = (malId: number) =>
        animeService.getDetail(malId).pipe(
          Effect.catchTag("AnimeNotFoundError", (error: AnimeNotFoundError) =>
            Effect.fail(
              new StreamingUnavailableError({ message: error.message })
            )
          ),
          Effect.catchTag("AnimeUnavailableError", (error) =>
            Effect.fail(
              new StreamingUnavailableError({ message: error.message })
            )
          )
        )

      const listEpisodes = Effect.fn("StreamingService.listEpisodes")(
        function* (malId: number) {
          const anime = yield* getAnime(malId)
          const provider-a = yield* aniKoto.getEpisodes(anime).pipe(
            Effect.tapError((error) =>
              Effect.logWarning("ProviderA episode lookup failed", {
                malId,
                message: error.message,
              })
            ),
            Effect.catchTag("ProviderAProviderError", (error) =>
              Effect.succeed({
                provider: "provider-a",
                providerAnimeId: null,
                status:
                  error.message === "ProviderA could not match this anime."
                    ? "unmatched"
                    : "unavailable",
                message: error.message,
                episodes: [],
              } as const)
            )
          )
          return { anime, providers: [provider-a] }
        }
      )

      const getPlayback = Effect.fn("StreamingService.getPlayback")(function* (
        malId: number,
        provider: StreamProviderId,
        episodeId: string,
        audio: StreamAudio
      ) {
        const anime = yield* getAnime(malId)
        const providers = {
          provider-a: () =>
            aniKoto.getPlayback(anime, episodeId, audio).pipe(
              Effect.tapError((error) =>
                Effect.logWarning("ProviderA playback lookup failed", {
                  malId,
                  episodeId,
                  audio,
                  message: error.message,
                })
              ),
              Effect.catchTag(
                "ProviderAProviderError",
                (
                  error
                ): Effect.Effect<
                  never,
                  StreamProviderNotFoundError | StreamEpisodeNotFoundError
                > =>
                  error.message === "ProviderA could not match this anime."
                    ? Effect.fail(
                        new StreamProviderNotFoundError({
                          provider,
                          malId,
                          message: error.message,
                        })
                      )
                    : Effect.fail(
                        new StreamEpisodeNotFoundError({
                          provider,
                          malId,
                          episodeId,
                          message: error.message,
                        })
                      )
              )
            ),
        } satisfies Record<
          StreamProviderId,
          () => Effect.Effect<
            StreamPlayback,
            StreamProviderNotFoundError | StreamEpisodeNotFoundError
          >
        >

        return yield* providers[provider]()
      })

      return { listEpisodes, getPlayback }
    }),
  }
) {}
