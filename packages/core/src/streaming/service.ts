import { animeStreamProviderMapping, Database } from "@animekaiser/db"
import type {
  AnimeDetail,
  StreamAudio,
  StreamEpisode,
  StreamEpisodeCatalog,
  StreamProviderAvailability,
  StreamProviderEpisodes,
  StreamProviderId,
} from "@animekaiser/domain"
import { StreamingUnavailableError } from "@animekaiser/domain"
import { and, eq } from "drizzle-orm"
import * as Effect from "effect/Effect"
import type { EpisodeMetadata } from "../anime"
import { AnimeService } from "../anime"
import { StreamingClient } from "../streaming-client"

const genericEpisodeTitle = /^(episode|ep\.?)\s*\d+$/i

const withMetadata = (
  episode: StreamEpisode,
  metadata: ReadonlyMap<number, EpisodeMetadata>
): StreamEpisode => {
  const known = metadata.get(episode.number)
  return {
    ...episode,
    title:
      known?.title && genericEpisodeTitle.test(episode.title.trim())
        ? known.title
        : episode.title,
    japaneseTitle:
      episode.japaneseTitle &&
      genericEpisodeTitle.test(episode.japaneseTitle.trim())
        ? null
        : episode.japaneseTitle,
    image: episode.image ?? known?.image ?? null,
    description: episode.description ?? known?.overview ?? null,
  }
}

const metadataByNumber = (episodes: ReadonlyArray<EpisodeMetadata>) =>
  new Map(episodes.map((item) => [item.number, item]))

export class StreamingService extends Effect.Service<StreamingService>()(
  "@animekaiser/core/StreamingService",
  {
    accessors: true,
    dependencies: [AnimeService.Default],
    effect: Effect.gen(function* () {
      const animeService = yield* AnimeService
      const streaming = yield* StreamingClient
      const database = yield* Database

      const getAnime = (malId: number) =>
        animeService.getDetail(malId).pipe(
          Effect.catchTags({
            AnimeNotFoundError: (error) =>
              Effect.fail(
                new StreamingUnavailableError({ message: error.message })
              ),
            AnimeUnavailableError: (error) =>
              Effect.fail(
                new StreamingUnavailableError({ message: error.message })
              ),
          })
        )

      const readMapping = (malId: number, provider: StreamProviderId) =>
        database
          .execute((db) =>
            db
              .select()
              .from(animeStreamProviderMapping)
              .where(
                and(
                  eq(animeStreamProviderMapping.malId, malId),
                  eq(animeStreamProviderMapping.provider, provider)
                )
              )
              .limit(1)
          )
          .pipe(
            Effect.map((rows) => rows.at(0)?.providerAnimeId ?? undefined),
            Effect.orElseSucceed(() => undefined)
          )

      // The service resolves the provider's own id for an anime; persisting it
      // lets later calls skip the title match entirely.
      const saveMapping = (
        malId: number,
        provider: StreamProviderId,
        providerAnimeId: string | null,
        matchedTitle: string | null
      ) =>
        providerAnimeId === null
          ? Effect.void
          : database
              .execute((db) =>
                db
                  .insert(animeStreamProviderMapping)
                  .values({ malId, provider, providerAnimeId, matchedTitle })
                  .onConflictDoUpdate({
                    target: [
                      animeStreamProviderMapping.malId,
                      animeStreamProviderMapping.provider,
                    ],
                    set: { providerAnimeId, matchedTitle },
                  })
              )
              .pipe(Effect.ignore)

      const episodesFor = (
        anime: AnimeDetail,
        provider: StreamProviderId,
        entryLabel: string
      ) =>
        Effect.gen(function* () {
          const known = yield* readMapping(anime.malId, provider)
          const episodes = yield* streaming.listEpisodes(anime, provider, known)
          yield* saveMapping(
            anime.malId,
            provider,
            episodes.providerAnimeId,
            episodes.matchedTitle
          )
          return episodes
        }).pipe(
          Effect.catchAll((error) =>
            Effect.succeed({
              provider,
              label: entryLabel,
              providerAnimeId: null,
              matchedTitle: null,
              status: "unavailable" as const,
              message: error.message,
              episodes: [],
            } satisfies StreamProviderEpisodes)
          )
        )

      // Requested provider wins when it exists; otherwise the first configured
      // provider is used. Shared so episodes and playback never disagree.
      const resolveProvider = (provider: StreamProviderId | undefined) =>
        Effect.map(
          streaming.listProviders,
          (providers) =>
            providers.find((entry) => entry.id === provider) ?? providers.at(0)
        )

      const listEpisodes = Effect.fn("StreamingService.listEpisodes")(
        function* (malId: number, provider?: StreamProviderId) {
          const anime = yield* getAnime(malId)
          if (anime.status === "NOT_YET_RELEASED") {
            return {
              anime,
              providers: [],
            } satisfies StreamEpisodeCatalog
          }

          const selected = yield* resolveProvider(provider)
          if (selected === undefined) {
            return {
              anime,
              providers: [],
            } satisfies StreamEpisodeCatalog
          }

          const [episodes, artwork] = yield* Effect.all(
            [
              episodesFor(anime, selected.id, selected.label),
              animeService
                .getEpisodeMetadata(malId)
                .pipe(Effect.map(metadataByNumber)),
            ],
            { concurrency: 2 }
          )

          return {
            anime,
            providers: [
              {
                ...episodes,
                episodes: episodes.episodes.map((episode) =>
                  withMetadata(episode, artwork)
                ),
              },
            ],
          } satisfies StreamEpisodeCatalog
        }
      )

      const getPlayback = Effect.fn("StreamingService.getPlayback")(function* (
        malId: number,
        provider: StreamProviderId,
        episodeId: string,
        audio: StreamAudio,
        serverId?: string
      ) {
        const anime = yield* getAnime(malId)
        const resolved = (yield* resolveProvider(provider))?.id ?? provider
        const known = yield* readMapping(malId, resolved)
        const playback = yield* streaming.getPlayback(
          anime,
          resolved,
          episodeId,
          audio,
          serverId,
          known
        )
        yield* saveMapping(malId, resolved, playback.providerAnimeId, null)
        const artwork = metadataByNumber(
          yield* animeService.getEpisodeMetadata(malId)
        )
        return { ...playback, episode: withMetadata(playback.episode, artwork) }
      })

      // Opened on demand from the provider picker: it asks every provider for
      // its episode list, which the streaming service caches.
      const listAvailability = Effect.fn("StreamingService.listAvailability")(
        function* (malId: number) {
          const anime = yield* getAnime(malId)
          const providers = yield* streaming.listProviders
          return yield* Effect.forEach(
            providers,
            (provider) =>
              episodesFor(anime, provider.id, provider.label).pipe(
                Effect.map(
                  (episodes): StreamProviderAvailability => ({
                    provider: provider.id,
                    label: provider.label,
                    status: episodes.status,
                    sub: episodes.episodes.filter((episode) =>
                      episode.availableAudio.includes("sub")
                    ).length,
                    dub: episodes.episodes.filter((episode) =>
                      episode.availableAudio.includes("dub")
                    ).length,
                  })
                )
              ),
            { concurrency: "unbounded" }
          )
        }
      )

      return {
        listEpisodes,
        listAvailability,
        getPlayback,
        listProviders: streaming.listProviders,
      }
    }),
  }
) {}
