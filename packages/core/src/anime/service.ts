import { animeDetailRecord, Database } from "@animekaiser/db"
import type { AnimeDiscoveryCategory } from "@animekaiser/domain"
import {
  AnimeDetail,
  AnimeItem,
  AnimeNotFoundError,
  AnimePage,
  AnimeUnavailableError,
  AnimeWatchOrder,
  LatestEpisode,
} from "@animekaiser/domain"
import { eq } from "drizzle-orm"
import * as Arr from "effect/Array"
import * as Clock from "effect/Clock"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as FiberMap from "effect/FiberMap"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type { AnimeCatalogRequest } from "./anilist"
import { AniListAnimeService } from "./anilist"
import { AniZipData, AniZipService } from "./anizip"
import { AnimeCache } from "./cache"
import { catalogPageSchema } from "./catalog-page"
import { JikanAnimeService } from "./jikan"
import { MalAnimeService } from "./mal"
import { ShikimoriFranchise, ShikimoriService } from "./shikimori"
import {
  buildWatchOrder,
  franchiseStoryNodes,
  storyComponent,
} from "./watch-order"

const cacheKey = (scope: string, value: object) =>
  `${scope}:${JSON.stringify(value)}`
const hour = 60 * 60
const day = 24 * hour
const fallbackTtlSeconds = 5 * 60

// How long a value stays in Redis after it stops being fresh, so it can
// still be served while a refresh runs or while upstreams are down.
const retentionSeconds = (ttlSeconds: number) =>
  Math.max(ttlSeconds * 4, 7 * day)

const Cached = <TValue, TEncoded>(schema: Schema.Codec<TValue, TEncoded>) =>
  Schema.Struct({ value: schema, freshUntil: Schema.Number })
type Cached<TValue> = { readonly value: TValue; readonly freshUntil: number }

type Durable<TValue> = {
  readonly read: Effect.Effect<Option.Option<Cached<TValue>>>
  readonly write: (entry: Cached<TValue>) => Effect.Effect<void>
}

// Finished shows rarely change; airing ones gain episodes and scores move.
const detailTtlSeconds = (detail: AnimeDetail | null) => {
  if (detail?.status === "FINISHED") return 30 * day
  if (detail?.status === "RELEASING") return 12 * hour
  return day
}
const NullableAnimeDetail = Schema.NullOr(AnimeDetail)

const toAnimeItem = ({
  description: _description,
  synonyms: _synonyms,
  tags: _tags,
  studios: _studios,
  trailer: _trailer,
  relations: _relations,
  externalLinks: _externalLinks,
  ...item
}: AnimeDetail): AnimeItem => item

// AniList synopses keep inline HTML even with asHtml:false, and end with
// credits like "(Source: Crunchyroll)" or "[Written by MAL Rewrite]", which
// read as noise in a three-line teaser.
export const heroSynopsis = (description: string | null) => {
  if (!description) return null
  const text = description
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s*[([](?:source|written by)[^)\]]*[)\]]\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
  return text.length > 0 ? text : null
}

// MAL search takes only text (3+ characters); anything filtered or sorted
// differently falls back to Jikan, which mirrors MAL's site filters.
const isTextSearch = (request: AnimeCatalogRequest) =>
  (request.query?.length ?? 0) >= 3 &&
  request.sort === "relevance" &&
  !request.status &&
  !request.format &&
  !request.genres?.length &&
  !request.season &&
  !request.seasonYear &&
  request.minScore === undefined &&
  request.maxScore === undefined

const HomeLists = Schema.Struct({
  trending: Schema.Array(
    Schema.Struct({
      ...AnimeItem.fields,
      description: Schema.NullOr(Schema.String),
    })
  ),
  seasonal: Schema.Array(AnimeItem),
  topRated: Schema.Array(AnimeItem),
  popular: Schema.Array(AnimeItem),
  upcoming: Schema.Array(AnimeItem),
})

export class AnimeService extends Context.Service<AnimeService>()(
  "@animekaiser/core/AnimeService",
  {
    make: Effect.gen(function* () {
      const cache = yield* AnimeCache
      const database = yield* Database
      const aniList = yield* AniListAnimeService
      const jikan = yield* JikanAnimeService
      const mal = yield* MalAnimeService
      const aniZip = yield* AniZipService
      const shikimori = yield* ShikimoriService

      const inFlight = yield* FiberMap.make<string>()
      const forkLoad = yield* FiberMap.runtime(inFlight)()

      // Concurrent misses on one key share a single load. The load is owned by
      // the service rather than the caller, so a disconnecting caller cannot
      // cancel it for the others.
      const singleFlight = <TValue, TError>(
        key: string,
        load: Effect.Effect<TValue, TError>
      ) =>
        Effect.suspend(() => {
          const existing = FiberMap.getUnsafe(inFlight, key)
          return Fiber.join(
            Option.isSome(existing)
              ? (existing.value as Fiber.Fiber<TValue, TError>)
              : forkLoad(key, load)
          )
        })

      type Loaded<TValue> = { value: TValue; ttlSeconds: number }

      const storeCached = <TValue, TEncoded>(
        key: string,
        schema: Schema.Codec<TValue, TEncoded>,
        entry: Cached<TValue>,
        durable?: Durable<TValue>
      ) =>
        Clock.currentTimeMillis.pipe(
          Effect.flatMap((now) =>
            Effect.all(
              [
                cache
                  .set(
                    key,
                    Cached(schema),
                    entry,
                    retentionSeconds((entry.freshUntil - now) / 1000)
                  )
                  .pipe(Effect.catchTag("AnimeCacheError", () => Effect.void)),
                durable ? durable.write(entry) : Effect.void,
              ],
              { discard: true }
            )
          )
        )

      // Values stay readable well past their freshness: a stale hit is served
      // at once and refreshed in the background, and only a miss waits on the
      // network. A failed refresh keeps the stale value instead of replacing
      // it with fallback data, and backs off before trying again. A durable
      // store, when given, sits under Redis and survives it being emptied.
      const cachedFor = <TValue, TEncoded, TError, TFallbackError = never>(
        key: string,
        schema: Schema.Codec<TValue, TEncoded>,
        load: Effect.Effect<Loaded<TValue>, TError>,
        fallback?: Effect.Effect<Loaded<TValue>, TFallbackError>,
        durable?: Durable<TValue>
      ): Effect.Effect<TValue, TError | TFallbackError> => {
        const initial: Effect.Effect<
          Loaded<TValue>,
          TError | TFallbackError
        > = fallback
          ? load.pipe(
              Effect.catch((error) =>
                Effect.logWarning("Serving fallback data", {
                  key,
                  error,
                }).pipe(
                  Effect.andThen(fallback),
                  Effect.map((loaded) => ({
                    ...loaded,
                    ttlSeconds: Math.min(loaded.ttlSeconds, fallbackTtlSeconds),
                  }))
                )
              )
            )
          : load

        const loadAndStore = (
          loading: Effect.Effect<Loaded<TValue>, TError | TFallbackError>
        ) =>
          singleFlight(
            key,
            loading.pipe(
              Effect.tap(({ value, ttlSeconds }) =>
                Clock.currentTimeMillis.pipe(
                  Effect.flatMap((now) =>
                    storeCached(
                      key,
                      schema,
                      { value, freshUntil: now + ttlSeconds * 1000 },
                      durable
                    )
                  )
                )
              ),
              Effect.map(({ value }) => value)
            )
          )

        const serve = Effect.fnUntraced(function* ({
          value,
          freshUntil,
        }: Cached<TValue>) {
          if (freshUntil > (yield* Clock.currentTimeMillis)) return value
          yield* loadAndStore(
            load.pipe(
              Effect.orElseSucceed(() => ({
                value,
                ttlSeconds: fallbackTtlSeconds,
              }))
            )
          ).pipe(Effect.ignore, Effect.forkDetach)
          return value
        })

        const fromDurable = durable
          ? durable.read.pipe(
              Effect.tap(
                Option.match({
                  onNone: () => Effect.void,
                  onSome: (entry) => storeCached(key, schema, entry),
                })
              )
            )
          : Effect.succeed(Option.none<Cached<TValue>>())

        return cache.get(key, Cached(schema)).pipe(
          Effect.catchTag("AnimeCacheError", () =>
            Effect.succeed(Option.none<Cached<TValue>>())
          ),
          Effect.flatMap((hit) =>
            Option.isSome(hit) ? Effect.succeed(hit) : fromDurable
          ),
          Effect.flatMap(
            (hit): Effect.Effect<TValue, TError | TFallbackError> =>
              Option.isSome(hit) ? serve(hit.value) : loadAndStore(initial)
          )
        )
      }

      const detailRecord = (malId: number): Durable<AnimeDetail | null> => ({
        read: database
          .execute((db) =>
            db
              .select()
              .from(animeDetailRecord)
              .where(eq(animeDetailRecord.malId, malId))
              .limit(1)
          )
          .pipe(
            Effect.flatMap(([row]) =>
              row
                ? Schema.decodeUnknownEffect(AnimeDetail)(row.detail).pipe(
                    Effect.map((detail) =>
                      Option.some({
                        value: detail,
                        freshUntil: row.freshUntil.getTime(),
                      })
                    )
                  )
                : Effect.succeed(Option.none())
            ),
            Effect.orElseSucceed(() => Option.none())
          ),
        write: ({ value, freshUntil }) =>
          value === null
            ? Effect.void
            : Schema.encodeEffect(AnimeDetail)(value).pipe(
                Effect.flatMap((detail) =>
                  database.execute((db) =>
                    db
                      .insert(animeDetailRecord)
                      .values({
                        malId,
                        detail,
                        freshUntil: new Date(freshUntil),
                      })
                      .onConflictDoUpdate({
                        target: animeDetailRecord.malId,
                        set: { detail, freshUntil: new Date(freshUntil) },
                      })
                  )
                ),
                Effect.tapError((error) =>
                  Effect.logWarning("Anime detail record write failed", {
                    malId,
                    error,
                  })
                ),
                Effect.ignore
              ),
      })

      const cached = <TValue, TEncoded, TError>(
        key: string,
        schema: Schema.Codec<TValue, TEncoded>,
        ttlSeconds: number,
        load: Effect.Effect<TValue, TError>
      ) =>
        cachedFor(
          key,
          schema,
          load.pipe(Effect.map((value) => ({ value, ttlSeconds })))
        )

      const cachedWithFallback = <TValue, TEncoded, TError, TFallbackError>(
        key: string,
        schema: Schema.Codec<TValue, TEncoded>,
        ttlSeconds: number,
        primary: Effect.Effect<TValue, TError>,
        fallback: Effect.Effect<TValue, TFallbackError>
      ) =>
        cachedFor(
          key,
          schema,
          primary.pipe(Effect.map((value) => ({ value, ttlSeconds }))),
          fallback.pipe(Effect.map((value) => ({ value, ttlSeconds })))
        )

      const getCatalog = Effect.fn("AnimeService.getCatalog")(function* (
        input: AnimeCatalogRequest
      ) {
        const request: AnimeCatalogRequest = {
          ...input,
          query: input.query?.trim().replace(/\s+/g, " ").toLowerCase(),
        }
        const studio = input.studio?.trim()
        const key = cacheKey("anime:catalog:v2", request)
        const ttlSeconds = 12 * hour
        const pageSchema = catalogPageSchema(request)
        const validatePage = Schema.decodeUnknownEffect(pageSchema)
        const unavailable = Effect.mapError(
          () =>
            new AnimeUnavailableError({
              message: "Anime catalog is unavailable.",
            })
        )
        if (studio) {
          const studioRequest = { ...request, studio }
          return yield* cachedWithFallback(
            cacheKey("anime:studio:v1", {
              studio: studio.toLowerCase(),
              page: request.page,
              perPage: request.perPage,
              sort: request.sort,
            }),
            AnimePage,
            ttlSeconds,
            aniList.getStudioCatalog(studioRequest),
            jikan.getStudioCatalog(studioRequest)
          ).pipe(unavailable)
        }
        if (request.rating) {
          return yield* cached(
            key,
            AnimePage,
            ttlSeconds,
            jikan.getCatalog(request)
          ).pipe(unavailable)
        }
        const fallback: Effect.Effect<AnimePage, unknown> =
          isTextSearch(request) && request.query
            ? mal.search(request.query, request.page, request.perPage)
            : jikan.getCatalog(request)
        return yield* cachedWithFallback(
          key,
          pageSchema,
          ttlSeconds,
          aniList.getCatalog(request).pipe(Effect.flatMap(validatePage)),
          fallback.pipe(Effect.flatMap(validatePage))
        ).pipe(unavailable)
      })

      const getDiscovery = Effect.fn("AnimeService.getDiscovery")(function* (
        category: AnimeDiscoveryCategory,
        page: number,
        perPage: number
      ) {
        return yield* cachedWithFallback(
          cacheKey("anime:discover:v2", { category, page, perPage }),
          AnimePage,
          category === "trending" ? 6 * hour : day,
          aniList.getDiscovery(category, page, perPage),
          mal.getDiscovery(category, page, perPage)
        ).pipe(
          Effect.mapError(
            () =>
              new AnimeUnavailableError({
                message: "Anime discovery is unavailable.",
              })
          )
        )
      })

      const homeFallback = Effect.all(
        {
          trending: mal.getDiscovery("trending", 1, 10),
          seasonal: mal.getDiscovery("seasonal", 1, 20),
          topRated: mal.getDiscovery("topRated", 1, 20),
          popular: mal.getDiscovery("popular", 1, 20),
          upcoming: mal.getDiscovery("upcoming", 1, 10),
        },
        { concurrency: 1 }
      ).pipe(
        Effect.map((pages) => ({
          trending: pages.trending.items.map((item) => ({
            ...item,
            description: null,
          })),
          seasonal: pages.seasonal.items,
          topRated: pages.topRated.items,
          popular: pages.popular.items,
          upcoming: pages.upcoming.items,
        }))
      )

      const getHome = Effect.fn("AnimeService.getHome")(function* () {
        const lists = yield* cachedWithFallback(
          "anime:home:v1",
          HomeLists,
          6 * hour,
          aniList.getHome(),
          homeFallback
        ).pipe(
          Effect.mapError(
            () =>
              new AnimeUnavailableError({
                message: "Anime home is unavailable.",
              })
          )
        )
        const trending = yield* Effect.forEach(
          lists.trending,
          ({ description, ...item }) =>
            getAniZip(item.malId).pipe(
              Effect.map((metadata) => ({
                ...item,
                description: heroSynopsis(description),
                backdrop: metadata.fanart ?? item.bannerImage,
              }))
            ),
          { concurrency: 5 }
        )
        return { ...lists, trending }
      })

      const getDetail = Effect.fn("AnimeService.getDetail")(function* (
        malId: number
      ) {
        const detail = yield* cachedFor(
          `anime:detail:v2:${malId}`,
          NullableAnimeDetail,
          aniList.getDetail(malId).pipe(
            Effect.map((value) => ({
              value,
              ttlSeconds: detailTtlSeconds(value),
            }))
          ),
          mal
            .getDetail(malId)
            .pipe(Effect.map((value) => ({ value, ttlSeconds: day }))),
          detailRecord(malId)
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

      // Background jobs that touch many shows fill the detail cache in
      // batches first, so their per-show getDetail calls hit the cache
      // instead of queueing one AniList request each.
      const prefetchDetails = Effect.fn("AnimeService.prefetchDetails")(
        function* (malIds: ReadonlyArray<number>) {
          const missing = yield* Effect.filter(
            [...new Set(malIds)],
            (malId) =>
              cache
                .get(`anime:detail:v2:${malId}`, Cached(NullableAnimeDetail))
                .pipe(
                  Effect.flatMap((hit) =>
                    Option.isSome(hit)
                      ? Effect.succeed(hit)
                      : detailRecord(malId).read
                  ),
                  Effect.map(Option.isNone),
                  Effect.orElseSucceed(() => true)
                ),
            { concurrency: 10 }
          )
          yield* Effect.forEach(
            Arr.chunksOf(missing, 50),
            (batch) =>
              aniList.getDetails(batch).pipe(
                Effect.flatMap((details) =>
                  Effect.forEach(
                    details,
                    (detail) =>
                      Clock.currentTimeMillis.pipe(
                        Effect.flatMap((now) =>
                          storeCached(
                            `anime:detail:v2:${detail.malId}`,
                            NullableAnimeDetail,
                            {
                              value: detail,
                              freshUntil: now + detailTtlSeconds(detail) * 1000,
                            },
                            detailRecord(detail.malId)
                          )
                        )
                      ),
                    { discard: true }
                  )
                ),
                Effect.catch((error) =>
                  Effect.logWarning("Detail prefetch failed", { error })
                )
              ),
            { discard: true }
          )
        }
      )

      const getFranchise = (malId: number) =>
        cached(
          `anime:franchise:v1:${malId}`,
          ShikimoriFranchise,
          7 * day,
          shikimori.getFranchise(malId)
        )

      const getItems = (malIds: ReadonlyArray<number>) =>
        Effect.forEach(Arr.chunksOf(malIds, 50), (batch) =>
          aniList.getItems(batch)
        ).pipe(Effect.map((batches) => batches.flat()))

      // One franchise graph from Shikimori plus one batched AniList lookup,
      // instead of a detail request per hop.
      const franchiseWatchOrder = Effect.fn("AnimeService.franchiseWatchOrder")(
        function* (malId: number) {
          const franchise = yield* getFranchise(malId)
          const ids = storyComponent(franchise.links, malId)
          const nodes = franchiseStoryNodes(
            franchise.links,
            yield* getItems(ids)
          )
          const start = nodes.get(malId)
          if (!start) {
            return yield* new AnimeUnavailableError({
              message: "Watch order start is missing from AniList.",
            })
          }
          const order = yield* buildWatchOrder(start, (id) => {
            const node = nodes.get(id)
            return node ? Effect.succeed(node) : Effect.fail(id)
          })
          return {
            entries: order.entries.map((node) => node.item),
            complete: order.complete,
          }
        }
      )

      const detailWalkWatchOrder = Effect.fn(
        "AnimeService.detailWalkWatchOrder"
      )(function* (malId: number) {
        const order = yield* buildWatchOrder(yield* getDetail(malId), getDetail)
        return {
          entries: order.entries.map(toAnimeItem),
          complete: order.complete,
        }
      })

      // New sequels get announced while a franchise is still airing.
      const watchOrderTtl = ({
        entries,
        complete,
      }: {
        entries: ReadonlyArray<AnimeItem>
        complete: boolean
      }) => ({
        value: { entries },
        ttlSeconds: !complete
          ? fallbackTtlSeconds
          : entries.some(
                (entry) =>
                  entry.status === "RELEASING" ||
                  entry.status === "NOT_YET_RELEASED"
              )
            ? day
            : 7 * day,
      })

      const getWatchOrder = Effect.fn("AnimeService.getWatchOrder")(function* (
        malId: number
      ) {
        return yield* cachedFor(
          `anime:watch-order:v2:${malId}`,
          AnimeWatchOrder,
          franchiseWatchOrder(malId).pipe(Effect.map(watchOrderTtl)),
          detailWalkWatchOrder(malId).pipe(Effect.map(watchOrderTtl))
        ).pipe(
          Effect.mapError((error) =>
            error instanceof AnimeNotFoundError
              ? error
              : new AnimeUnavailableError({
                  message: "Watch order is unavailable.",
                })
          )
        )
      })

      const getRecommendations = Effect.fn("AnimeService.getRecommendations")(
        function* (malId: number, page: number, perPage: number) {
          return yield* cachedWithFallback(
            `anime:recommendations:v2:${malId}:${page}:${perPage}`,
            AnimePage,
            7 * day,
            aniList.getRecommendations(malId, page, perPage),
            mal.getRecommendations(malId, page, perPage)
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
        return yield* cachedWithFallback(
          `anime:schedule:v2:${from}:${to}:${page}:${perPage}`,
          AnimePage,
          hour,
          aniList.getSchedule(from, to, page, perPage),
          jikan.getSchedule(page, perPage)
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
          day,
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
            Math.floor(
              (yield* Clock.currentTimeMillis) / 1000 / latestBucketSeconds
            ) * latestBucketSeconds
          const from = to - latestWindowSeconds
          return yield* cached(
            `anime:latest:v1:${to}`,
            Schema.Array(LatestEpisode),
            latestBucketSeconds,
            aniList.getRecentSchedule(from, to).pipe(
              Effect.map((items) =>
                items
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
        prefetchDetails,
        getWatchOrder,
        getRecommendations,
        getSchedule,
        getLatestEpisodes,
        getEpisodeMetadata,
        getRandom,
      }
    }),
  }
) {
  static readonly layer = Layer.effect(AnimeService, AnimeService.make).pipe(
    Layer.provide([
      AniListAnimeService.layer,
      AniZipService.layer,
      AnimeCache.layer,
      JikanAnimeService.layer,
      MalAnimeService.layer,
      ShikimoriService.layer,
    ])
  )
}
