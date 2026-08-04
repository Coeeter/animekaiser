import { animeStreamProviderMapping, Database } from "@animekaiser/db"
import type {
  AnimeDetail,
  StreamAudio,
  StreamEpisodeCatalog,
  StreamProviderEpisodes,
  StreamProviderId,
} from "@animekaiser/domain"
import { StreamingUnavailableError } from "@animekaiser/domain"
import { and, eq } from "drizzle-orm"
import * as Effect from "effect/Effect"
import { AnimeService } from "../anime"
import { StreamingClient } from "../streaming-client"

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

          const episodes = yield* episodesFor(
            anime,
            selected.id,
            selected.label
          )

          return {
            anime,
            providers: [episodes],
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
        return playback
      })

      return {
        listEpisodes,
        getPlayback,
        listProviders: streaming.listProviders,
      }
    }),
  }
) {}
