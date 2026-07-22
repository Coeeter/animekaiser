import type {
  AnimeNotFoundError,
  StreamAudio,
  StreamPlayback,
  StreamProviderEpisodes,
  StreamProviderId,
} from "@workspace/domain"
import {
  StreamEpisodeNotFoundError,
  StreamingUnavailableError,
  StreamProviderNotFoundError,
} from "@workspace/domain"
import * as Effect from "effect/Effect"
import { AnimeService } from "../anime"
import { ProviderAProvider } from "./provider-a"
import { ProviderDProvider } from "./provider-d"
import { ProviderBProvider } from "./provider-b"
import { ProviderCProvider } from "./provider-c"
import { FourAnimoProvider } from "./provider-e"

export class StreamingService extends Effect.Service<StreamingService>()(
  "@workspace/core/StreamingService",
  {
    accessors: true,
    dependencies: [
      AnimeService.Default,
      ProviderAProvider.Default,
      ProviderBProvider.Default,
      ProviderCProvider.Default,
      ProviderDProvider.Default,
      FourAnimoProvider.Default,
    ],
    effect: Effect.gen(function* () {
      const animeService = yield* AnimeService
      const aniKoto = yield* ProviderAProvider
      const animeStream = yield* ProviderBProvider
      const aniNeko = yield* ProviderCProvider
      const animeHub = yield* ProviderDProvider
      const fourAnimo = yield* FourAnimoProvider

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

      const notReleasedMessage = "This anime has not been released yet."
      const unmatchedMessages = new Set([
        "ProviderA could not match this anime.",
        "ProviderB could not match this anime.",
        "ProviderC could not match this anime.",
        "ProviderD could not match this anime.",
        "ProviderE could not match this anime.",
      ])
      const listEpisodes = Effect.fn("StreamingService.listEpisodes")(
        function* (malId: number, provider: StreamProviderId) {
          const anime = yield* getAnime(malId)
          if (anime.status === "NOT_YET_RELEASED") {
            return {
              anime,
              providers: [
                {
                  provider,
                  providerAnimeId: null,
                  status: "unavailable",
                  message: notReleasedMessage,
                  episodes: [],
                } satisfies StreamProviderEpisodes,
              ],
            } as const
          }

          const provider-a = aniKoto.getEpisodes(anime).pipe(
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
                status: unmatchedMessages.has(error.message)
                  ? "unmatched"
                  : "unavailable",
                message: error.message,
                episodes: [],
              } as const)
            )
          )
          const provider-b = animeStream.getEpisodes(anime).pipe(
            Effect.tapError((error) =>
              Effect.logWarning("ProviderB episode lookup failed", {
                malId,
                message: error.message,
              })
            ),
            Effect.catchTag("ProviderBProviderError", (error) =>
              Effect.succeed({
                provider: "provider-b",
                providerAnimeId: null,
                status: unmatchedMessages.has(error.message)
                  ? "unmatched"
                  : "unavailable",
                message: error.message,
                episodes: [],
              } as const)
            )
          )
          const provider-c = aniNeko.getEpisodes(anime).pipe(
            Effect.tapError((error) =>
              Effect.logWarning("ProviderC episode lookup failed", {
                malId,
                message: error.message,
              })
            ),
            Effect.catchTag("ProviderCProviderError", (error) =>
              Effect.succeed({
                provider: "provider-c",
                providerAnimeId: null,
                status: unmatchedMessages.has(error.message)
                  ? "unmatched"
                  : "unavailable",
                message: error.message,
                episodes: [],
              } as const)
            )
          )
          const provider-d = animeHub.getEpisodes(anime).pipe(
            Effect.tapError((error) =>
              Effect.logWarning("ProviderD episode lookup failed", {
                malId,
                message: error.message,
              })
            ),
            Effect.catchTag("ProviderDProviderError", (error) =>
              Effect.succeed({
                provider: "provider-d",
                providerAnimeId: null,
                status: unmatchedMessages.has(error.message)
                  ? "unmatched"
                  : "unavailable",
                message: error.message,
                episodes: [],
              } as const)
            )
          )
          const fouranimo = fourAnimo.getEpisodes(anime).pipe(
            Effect.tapError((error) =>
              Effect.logWarning("ProviderE episode lookup failed", {
                malId,
                message: error.message,
              })
            ),
            Effect.catchTag("FourAnimoProviderError", (error) =>
              Effect.succeed({
                provider: "provider-e",
                providerAnimeId: null,
                status: unmatchedMessages.has(error.message)
                  ? "unmatched"
                  : "unavailable",
                message: error.message,
                episodes: [],
              } as const)
            )
          )
          const providers = {
            provider-a,
            provider-b,
            provider-c,
            provider-d,
            "provider-e": fouranimo,
          } satisfies Record<
            StreamProviderId,
            Effect.Effect<StreamProviderEpisodes>
          >
          return { anime, providers: [yield* providers[provider]] }
        }
      )

      const getPlayback = Effect.fn("StreamingService.getPlayback")(function* (
        malId: number,
        provider: StreamProviderId,
        episodeId: string,
        audio: StreamAudio,
        serverId?: string | undefined
      ) {
        const anime = yield* getAnime(malId)
        if (anime.status === "NOT_YET_RELEASED") {
          return yield* new StreamProviderNotFoundError({
            provider,
            malId,
            message: notReleasedMessage,
          })
        }

        const providerFailure = (
          message: string
        ): Effect.Effect<
          never,
          StreamProviderNotFoundError | StreamEpisodeNotFoundError
        > =>
          unmatchedMessages.has(message)
            ? Effect.fail(
                new StreamProviderNotFoundError({ provider, malId, message })
              )
            : Effect.fail(
                new StreamEpisodeNotFoundError({
                  provider,
                  malId,
                  episodeId,
                  message,
                })
              )

        const providers = {
          provider-a: () =>
            aniKoto.getPlayback(anime, episodeId, audio, serverId).pipe(
              Effect.tapError((error) =>
                Effect.logWarning("ProviderA playback lookup failed", {
                  malId,
                  episodeId,
                  audio,
                  serverId,
                  message: error.message,
                })
              ),
              Effect.catchTag("ProviderAProviderError", (error) =>
                providerFailure(error.message)
              )
            ),
          provider-b: () =>
            animeStream.getPlayback(anime, episodeId, audio, serverId).pipe(
              Effect.tapError((error) =>
                Effect.logWarning("ProviderB playback lookup failed", {
                  malId,
                  episodeId,
                  audio,
                  serverId,
                  message: error.message,
                })
              ),
              Effect.catchTag("ProviderBProviderError", (error) =>
                providerFailure(error.message)
              )
            ),
          provider-c: () =>
            aniNeko.getPlayback(anime, episodeId, audio, serverId).pipe(
              Effect.tapError((error) =>
                Effect.logWarning("ProviderC playback lookup failed", {
                  malId,
                  episodeId,
                  audio,
                  serverId,
                  message: error.message,
                })
              ),
              Effect.catchTag("ProviderCProviderError", (error) =>
                providerFailure(error.message)
              )
            ),
          provider-d: () =>
            animeHub.getPlayback(anime, episodeId, audio, serverId).pipe(
              Effect.tapError((error) =>
                Effect.logWarning("ProviderD playback lookup failed", {
                  malId,
                  episodeId,
                  audio,
                  serverId,
                  message: error.message,
                })
              ),
              Effect.catchTag("ProviderDProviderError", (error) =>
                providerFailure(error.message)
              )
            ),
          "provider-e": () =>
            fourAnimo.getPlayback(anime, episodeId, audio, serverId).pipe(
              Effect.tapError((error) =>
                Effect.logWarning("ProviderE playback lookup failed", {
                  malId,
                  episodeId,
                  audio,
                  serverId,
                  message: error.message,
                })
              ),
              Effect.catchTag("FourAnimoProviderError", (error) =>
                providerFailure(error.message)
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
