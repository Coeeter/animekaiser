import type { AnimeDiscoveryCategory } from "@workspace/domain"
import {
  AnimeDetail,
  AnimeHome,
  AnimeNotFoundError,
  AnimePage,
  AnimeUnavailableError,
} from "@workspace/domain"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type { AnimeCatalogRequest } from "./anilist"
import { AniListAnimeService } from "./anilist"
import { AnimeCache } from "./cache"
import { JikanAnimeService } from "./jikan"

const cacheKey = (scope: string, value: object) =>
  `${scope}:${JSON.stringify(value)}`
const NullableAnimeDetail = Schema.NullOr(AnimeDetail)

export class AnimeService extends Effect.Service<AnimeService>()(
  "@workspace/core/AnimeService",
  {
    accessors: true,
    dependencies: [
      AniListAnimeService.Default,
      AnimeCache.Default,
      JikanAnimeService.Default,
    ],
    effect: Effect.gen(function* () {
      const cache = yield* AnimeCache
      const aniList = yield* AniListAnimeService
      const jikan = yield* JikanAnimeService

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
          "anime:home:v2",
          AnimeHome,
          2 * 60 * 60,
          Effect.all(
            {
              trending: getDiscovery("trending", 1, 10).pipe(
                Effect.map((page) => page.items)
              ),
              seasonal: getDiscovery("seasonal", 1, 20).pipe(
                Effect.map((page) => page.items)
              ),
              popular: getDiscovery("popular", 1, 20).pipe(
                Effect.map((page) => page.items)
              ),
            },
            { concurrency: 3 }
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
        getRandom,
      }
    }),
  }
) {}
