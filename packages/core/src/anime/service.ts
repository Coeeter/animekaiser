import type { AnimeDiscoveryCategory } from "@animekaiser/domain"
import {
  AnimeDetail,
  AnimeHome,
  AnimeNotFoundError,
  AnimePage,
  AnimeUnavailableError,
  LatestEpisode,
} from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type { AnimeCatalogRequest } from "./anilist"
import { AniListAnimeService } from "./anilist"
import { AniZipData, AniZipService } from "./anizip"
import { AnimeCache } from "./cache"
import { JikanAnimeService } from "./jikan"

const cacheKey = (scope: string, value: object) =>
  `${scope}:${JSON.stringify(value)}`
const NullableAnimeDetail = Schema.NullOr(AnimeDetail)

// AniList synopses end with credits like "(Source: Crunchyroll)" or
// "[Written by MAL Rewrite]", which read as noise in a three-line teaser.
export const heroSynopsis = (description: string | null) => {
  if (!description) return null
  const text = description
    .replace(/\s*[([](?:source|written by)[^)\]]*[)\]]\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
  return text.length > 0 ? text : null
}

export class AnimeService extends Effect.Service<AnimeService>()(
  "@animekaiser/core/AnimeService",
  {
    accessors: true,
    dependencies: [
      AniListAnimeService.Default,
      AniZipService.Default,
      AnimeCache.Default,
      JikanAnimeService.Default,
    ],
    effect: Effect.gen(function* () {
      const cache = yield* AnimeCache
      const aniList = yield* AniListAnimeService
      const jikan = yield* JikanAnimeService
      const aniZip = yield* AniZipService

      const cached = <TValue, TEncoded, TError, TRequirements>(
        key: string,
        schema: Schema.Schema<TValue, TEncoded>,
        ttlSeconds: number,
        load: Effect.Effect<TValue, TError, TRequirements>
      ) =>
        cache.get(key, schema).pipe(
          Effect.catchTag("AnimeCacheError", () =>
            Effect.succeed(Option.none<TValue>())
          ),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                load.pipe(
                  Effect.tap((value) =>
                    cache
                      .set(key, schema, value, ttlSeconds)
                      .pipe(
                        Effect.catchTag("AnimeCacheError", () => Effect.void)
                      )
                  )
                ),
              onSome: Effect.succeed,
            })
          )
        )

      const getCatalog = Effect.fn("AnimeService.getCatalog")(function* (
        input: AnimeCatalogRequest
      ) {
        const load = input.rating
          ? jikan.getCatalog(input)
          : aniList
              .getCatalog(input)
              .pipe(
                Effect.catchTag("AniListRequestError", () =>
                  jikan.getCatalog(input)
                )
              )
        return yield* cached(
          cacheKey("anime:catalog:v2", input),
          AnimePage,
          6 * 60 * 60,
          load
        ).pipe(
          Effect.mapError(
            () =>
              new AnimeUnavailableError({
                message: "Anime catalog is unavailable.",
              })
          )
        )
      })

      const getDiscovery = Effect.fn("AnimeService.getDiscovery")(function* (
        category: AnimeDiscoveryCategory,
        page: number,
        perPage: number
      ) {
        const fallbackInput: AnimeCatalogRequest = {
          page,
          perPage,
          sort:
            category === "trending"
              ? "trending"
              : category === "topRated"
                ? "score"
                : category === "upcoming"
                  ? "newest"
                  : "popularity",
          status: category === "upcoming" ? "upcoming" : undefined,
        }
        return yield* cached(
          cacheKey("anime:discover:v2", { category, page, perPage }),
          AnimePage,
          category === "trending" ? 2 * 60 * 60 : 12 * 60 * 60,
          aniList
            .getDiscovery(category, page, perPage)
            .pipe(
              Effect.catchTag("AniListRequestError", () =>
                jikan.getCatalog(fallbackInput)
              )
            )
        ).pipe(
          Effect.mapError(
            () =>
              new AnimeUnavailableError({
                message: "Anime discovery is unavailable.",
              })
          )
        )
      })

      const getHome = Effect.fn("AnimeService.getHome")(function* () {
        return yield* cached(
          "anime:home:v5",
          AnimeHome,
          2 * 60 * 60,
          Effect.all(
            {
              trending: getDiscovery("trending", 1, 10).pipe(
                Effect.flatMap((page) =>
                  Effect.forEach(
                    page.items,
                    (item) =>
                      Effect.all(
                        {
                          metadata: getAniZip(item.malId),
                          description: getDetail(item.malId).pipe(
                            Effect.map((detail) =>
                              heroSynopsis(detail.description)
                            ),
                            Effect.orElseSucceed(() => null)
                          ),
                        },
                        { concurrency: 2 }
                      ).pipe(
                        Effect.map(({ metadata, description }) => ({
                          ...item,
                          description,
                          backdrop: metadata.fanart ?? item.bannerImage,
                        }))
                      ),
                    { concurrency: 5 }
                  )
                )
              ),
              seasonal: getDiscovery("seasonal", 1, 20).pipe(
                Effect.map((page) => page.items)
              ),
              topRated: getDiscovery("topRated", 1, 20).pipe(
                Effect.map((page) => page.items)
              ),
              popular: getDiscovery("popular", 1, 20).pipe(
                Effect.map((page) => page.items)
              ),
            },
            { concurrency: 4 }
          )
        )
      })

      const getDetail = Effect.fn("AnimeService.getDetail")(function* (
        malId: number
      ) {
        const detail = yield* cached(
          `anime:detail:v2:${malId}`,
          NullableAnimeDetail,
          12 * 60 * 60,
          aniList
            .getDetail(malId)
            .pipe(
              Effect.catchTag("AniListRequestError", () =>
                jikan.getDetail(malId)
              )
            )
        ).pipe(
          Effect.mapError(
            () =>
              new AnimeUnavailableError({
                message: "Anime detail is unavailable.",
              })
          )
        )
        if (!detail) {
          return yield* new AnimeNotFoundError({
            malId,
            message: "Anime was not found.",
          })
        }
        return detail
      })

      const getRecommendations = Effect.fn("AnimeService.getRecommendations")(
        function* (malId: number, page: number, perPage: number) {
          return yield* cached(
            `anime:recommendations:v2:${malId}:${page}:${perPage}`,
            AnimePage,
            7 * 24 * 60 * 60,
            aniList
              .getRecommendations(malId, page, perPage)
              .pipe(
                Effect.catchTag("AniListRequestError", () =>
                  jikan.getRecommendations(malId, page, perPage)
                )
              )
          ).pipe(
            Effect.mapError(
              () =>
                new AnimeUnavailableError({
                  message: "Recommendations are unavailable.",
                })
            )
          )
        }
      )

      const getSchedule = Effect.fn("AnimeService.getSchedule")(function* (
        from: number,
        to: number,
        page: number,
        perPage: number
      ) {
        return yield* cached(
          `anime:schedule:v2:${from}:${to}:${page}:${perPage}`,
          AnimePage,
          60 * 60,
          aniList
            .getSchedule(from, to, page, perPage)
            .pipe(
              Effect.catchTag("AniListRequestError", () =>
                jikan.getSchedule(page, perPage)
              )
            )
        ).pipe(
          Effect.mapError(
            () =>
              new AnimeUnavailableError({
                message: "Anime schedule is unavailable.",
              })
          )
        )
      })

      // ani.zip only decorates or cross-checks other sources, so callers get
      // empty data instead of an error.
      const getAniZip = Effect.fn("AnimeService.getAniZip")(function* (
        malId: number
      ) {
        return yield* cached(
          `anime:anizip:v1:${malId}`,
          AniZipData,
          24 * 60 * 60,
          aniZip.getData(malId)
        ).pipe(
          Effect.tapError((error) =>
            Effect.logWarning("ani.zip data is unavailable", {
              malId,
              message: error.message,
            })
          ),
          Effect.orElseSucceed(
            (): AniZipData => ({ episodes: [], fanart: null })
          )
        )
      })

      const getEpisodeMetadata = (malId: number) =>
        getAniZip(malId).pipe(Effect.map((data) => data.episodes))

      const latestWindowSeconds = 3 * 24 * 60 * 60
      const latestBucketSeconds = 15 * 60

      // Bucketing "now" lets every request in the same 15 minutes share one
      // cached AniList lookup.
      const getLatestEpisodes = Effect.fn("AnimeService.getLatestEpisodes")(
        function* () {
          const to =
            Math.floor(Date.now() / 1000 / latestBucketSeconds) *
            latestBucketSeconds
          const from = to - latestWindowSeconds
          return yield* cached(
            `anime:latest:v1:${to}`,
            Schema.Array(LatestEpisode),
            latestBucketSeconds,
            Effect.forEach([1, 2], (page) =>
              aniList.getSchedule(from, to, page, 50)
            ).pipe(
              Effect.map((pages) =>
                pages
                  .flatMap((page) => page.items)
                  .flatMap((anime) =>
                    anime.nextAiringEpisode && !anime.isAdult
                      ? [{ anime, next: anime.nextAiringEpisode }]
                      : []
                  )
                  .sort(
                    (left, right) => right.next.airingAt - left.next.airingAt
                  )
              ),
              Effect.flatMap((items) =>
                Effect.forEach(
                  items,
                  ({ anime, next }) =>
                    getAniZip(anime.malId).pipe(
                      Effect.map(
                        (data): LatestEpisode => ({
                          anime,
                          episode: next.episode,
                          airedAt: next.airingAt,
                          image:
                            data.episodes.find(
                              (episode) => episode.number === next.episode
                            )?.image ?? null,
                        })
                      )
                    ),
                  { concurrency: 6 }
                )
              )
            )
          ).pipe(
            Effect.mapError(
              () =>
                new AnimeUnavailableError({
                  message: "Latest episodes are unavailable.",
                })
            )
          )
        }
      )

      const getRandom = Effect.fn("AnimeService.getRandom")(function* () {
        const page = yield* getDiscovery("popular", 1, 50)
        const item = page.items.at(
          Math.floor(Math.random() * page.items.length)
        )
        if (!item) {
          return yield* new AnimeUnavailableError({
            message: "No anime is available.",
          })
        }
        return item.malId
      })

      return {
        getCatalog,
        getDiscovery,
        getHome,
        getDetail,
        getRecommendations,
        getSchedule,
        getLatestEpisodes,
        getEpisodeMetadata,
        getRandom,
      }
    }),
  }
) {}
