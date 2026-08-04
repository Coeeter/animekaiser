import type { StreamPlaybackFailure } from "@animekaiser/core"
import { StreamingClient } from "@animekaiser/core"
import type {
  AnimeDetail,
  StreamProvider,
  StreamProviderId,
} from "@animekaiser/domain"
import {
  StreamEpisodeNotFoundError,
  StreamingUnavailableError,
  StreamProviderNotFoundError,
  StreamProviderUnavailableError,
} from "@animekaiser/domain"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "@effect/rpc"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import { Env } from "../env"

const StreamAudio = Schema.Literal("sub", "dub")

const StreamAnime = Schema.Struct({
  malId: Schema.Int,
  title: Schema.Struct({
    romaji: Schema.String,
    english: Schema.NullOr(Schema.String),
  }),
  synonyms: Schema.Array(Schema.String),
  format: Schema.NullOr(Schema.String),
  status: Schema.NullOr(Schema.String),
  season: Schema.NullOr(Schema.String),
  seasonYear: Schema.NullOr(Schema.Int),
})

const StreamServer = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  audio: StreamAudio,
  isDefault: Schema.optional(Schema.Boolean),
})

const StreamEpisode = Schema.Struct({
  id: Schema.String,
  number: Schema.Number,
  title: Schema.String,
  japaneseTitle: Schema.NullOr(Schema.String),
  availableAudio: Schema.Array(StreamAudio),
  updatedAt: Schema.NullOr(Schema.String),
})

const StreamTrack = Schema.Struct({
  file: Schema.String,
  label: Schema.String,
  kind: Schema.String,
  default: Schema.Boolean,
})

const StreamSkipSegment = Schema.Struct({
  start: Schema.Number,
  end: Schema.Number,
})

const RemoteProvider = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
})

const RemoteProviderEpisodes = Schema.Struct({
  provider: Schema.String,
  providerAnimeId: Schema.NullOr(Schema.String),
  matchedTitle: Schema.NullOr(Schema.String),
  status: Schema.Literal("available", "unmatched", "unavailable"),
  message: Schema.NullOr(Schema.String),
  episodes: Schema.Array(StreamEpisode),
})

const RemotePlayback = Schema.Struct({
  provider: Schema.String,
  providerAnimeId: Schema.String,
  matchedTitle: Schema.NullOr(Schema.String),
  episode: StreamEpisode,
  audio: StreamAudio,
  server: StreamServer,
  servers: Schema.Array(StreamServer),
  sourceUrl: Schema.String,
  sourceRefererUrl: Schema.String,
  iframeUrl: Schema.String,
  tracks: Schema.Array(StreamTrack),
  intro: Schema.NullOr(StreamSkipSegment),
  outro: Schema.NullOr(StreamSkipSegment),
  proxiedSourceUrl: Schema.String,
  proxiedTracks: Schema.Array(StreamTrack),
  proxyExpiresAt: Schema.Int,
})

const remoteFailure = Schema.Union(
  StreamingUnavailableError,
  StreamProviderNotFoundError,
  StreamProviderUnavailableError,
  StreamEpisodeNotFoundError
)

class ListStreamProviders extends Rpc.make("ListStreamProviders", {
  success: Schema.Array(RemoteProvider),
}) {}

class ListStreamEpisodes extends Rpc.make("ListStreamEpisodes", {
  payload: {
    anime: StreamAnime,
    provider: Schema.String,
    providerAnimeId: Schema.optional(Schema.String),
  },
  success: RemoteProviderEpisodes,
  error: StreamingUnavailableError,
}) {}

class GetStreamPlayback extends Rpc.make("GetStreamPlayback", {
  payload: {
    anime: StreamAnime,
    provider: Schema.String,
    episodeId: Schema.String,
    audio: StreamAudio,
    serverId: Schema.optional(Schema.String),
    providerAnimeId: Schema.optional(Schema.String),
  },
  success: RemotePlayback,
  error: remoteFailure,
}) {}

class StreamingRpcs extends RpcGroup.make(
  ListStreamProviders,
  ListStreamEpisodes,
  GetStreamPlayback
) {}

const toStreamAnime = (anime: AnimeDetail) => ({
  malId: anime.malId,
  title: { romaji: anime.title.romaji, english: anime.title.english ?? null },
  synonyms: anime.synonyms ?? [],
  format: anime.format ?? null,
  status: anime.status ?? null,
  season: anime.season ?? null,
  seasonYear: anime.seasonYear ?? null,
})

// The service reports failures with the upstream provider's own name in the
// message. Those names must not reach clients or logs, so only the shape of the
// failure survives the boundary.
const unavailable = (message: string) =>
  new StreamingUnavailableError({ message })

const neutralEpisodes = (
  episodes: typeof RemoteProviderEpisodes.Type,
  label: string
) => ({
  ...episodes,
  message:
    episodes.message === null
      ? null
      : episodes.status === "unmatched"
        ? `${label} could not match this anime.`
        : `${label} is currently unavailable.`,
})

export const StreamingClientLive = Layer.scoped(
  StreamingClient,
  Effect.gen(function* () {
    const client = yield* RpcClient.make(StreamingRpcs)

    const labels = yield* Effect.cachedWithTTL(
      client.ListStreamProviders().pipe(
        Effect.map(
          (providers) =>
            new Map(providers.map((provider) => [provider.id, provider.label]))
        ),
        Effect.catchAll(() => Effect.succeed(new Map<string, string>()))
      ),
      "1 hour"
    )

    const labelFor = (provider: string) =>
      labels.pipe(Effect.map((map) => map.get(provider) ?? "This provider"))

    return {
      listProviders: client.ListStreamProviders().pipe(
        Effect.map(
          (providers): ReadonlyArray<StreamProvider> =>
            providers.map((provider) => ({
              id: provider.id as StreamProviderId,
              label: provider.label,
            }))
        ),
        Effect.mapError(() =>
          unavailable("Streaming is currently unavailable.")
        )
      ),

      listEpisodes: (
        anime: AnimeDetail,
        provider: StreamProviderId,
        providerAnimeId?: string
      ) =>
        Effect.gen(function* () {
          const label = yield* labelFor(provider)
          const episodes = yield* client
            .ListStreamEpisodes({
              anime: toStreamAnime(anime),
              provider,
              providerAnimeId,
            })
            .pipe(
              Effect.mapError(() =>
                unavailable(`${label} is currently unavailable.`)
              )
            )
          return {
            ...neutralEpisodes(episodes, label),
            provider: episodes.provider as StreamProviderId,
            label,
          }
        }),

      getPlayback: (
        anime: AnimeDetail,
        provider: StreamProviderId,
        episodeId: string,
        audio: "sub" | "dub",
        serverId?: string,
        providerAnimeId?: string
      ) =>
        Effect.gen(function* () {
          const label = yield* labelFor(provider)
          const playback = yield* client
            .GetStreamPlayback({
              anime: toStreamAnime(anime),
              provider,
              episodeId,
              audio,
              serverId,
              providerAnimeId,
            })
            .pipe(
              Effect.mapError((error): StreamPlaybackFailure => {
                switch (error._tag) {
                  case "StreamProviderNotFoundError":
                    return new StreamProviderNotFoundError({
                      provider,
                      malId: anime.malId,
                      message: `${label} could not match this anime.`,
                    })
                  case "StreamProviderUnavailableError":
                    return new StreamProviderUnavailableError({
                      provider,
                      malId: anime.malId,
                      message: `${label} is currently unavailable.`,
                    })
                  case "StreamEpisodeNotFoundError":
                    return new StreamEpisodeNotFoundError({
                      provider,
                      malId: anime.malId,
                      episodeId,
                      message: "This episode is unavailable.",
                    })
                  default:
                    return unavailable("Streaming is currently unavailable.")
                }
              })
            )

          return {
            anime,
            provider: playback.provider as StreamProviderId,
            providerAnimeId: playback.providerAnimeId,
            episode: playback.episode,
            audio: playback.audio,
            server: playback.server,
            servers: playback.servers,
            sourceUrl: playback.proxiedSourceUrl,
            tracks: playback.proxiedTracks,
            expiresAt: playback.proxyExpiresAt,
            intro: playback.intro,
            outro: playback.outro,
          }
        }),
    }
  })
).pipe(
  Layer.provide(
    Layer.unwrapEffect(
      Effect.gen(function* () {
        const env = yield* Env
        const authed = Layer.effect(
          HttpClient.HttpClient,
          Effect.map(HttpClient.HttpClient, (client) =>
            HttpClient.mapRequest(
              client,
              HttpClientRequest.setHeader(
                env.streaming.secretHeader,
                Redacted.value(env.streaming.secret)
              )
            )
          )
        ).pipe(Layer.provide(FetchHttpClient.layer))

        return RpcClient.layerProtocolHttp({ url: env.streaming.url }).pipe(
          Layer.provide(authed),
          Layer.provide(RpcSerialization.layerNdjson)
        )
      })
    )
  ),
  Layer.provide(Env.Default)
)
