import type {
  AnimeCatalogStatus,
  AnimeDetail,
  AnimeDiscoveryCategory,
  AnimeFormat,
  AnimeItem,
  AnimePage,
  AnimeRating,
  AnimeSeason,
  AnimeSort,
} from "@animekaiser/domain"
import {
  AnimeDetail as AnimeDetailSchema,
  AnimePage as AnimePageSchema,
} from "@animekaiser/domain"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as Effect from "effect/Effect"
import * as RateLimiter from "effect/RateLimiter"
import * as Schema from "effect/Schema"

export class AniListRequestError extends Schema.TaggedError<AniListRequestError>()(
  "AniListRequestError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}

export const logAniListRateLimit =
  (source: string) => (response: HttpClientResponse.HttpClientResponse) =>
    response.status === 429
      ? Effect.logWarning("AniList rate limited", {
          source,
          retryAfter: response.headers["retry-after"],
          limit: response.headers["x-ratelimit-limit"],
          reset: response.headers["x-ratelimit-reset"],
        })
      : Effect.void

const PositiveInt = Schema.Int.pipe(Schema.positive())
const NullableString = Schema.NullOr(Schema.String)
const NullableInt = Schema.NullOr(Schema.Int)

const AniListGraphQlError = Schema.Struct({
  message: Schema.String,
  status: Schema.optional(Schema.Int),
})

const AniListTitle = Schema.Struct({
  romaji: NullableString,
  english: NullableString,
})

const AniListCover = Schema.Struct({
  extraLarge: NullableString,
  large: NullableString,
  medium: NullableString,
})

const AniListNextEpisode = Schema.Struct({
  episode: PositiveInt,
  airingAt: PositiveInt,
})

const AniListMediaStatus = Schema.Literal(
  "FINISHED",
  "RELEASING",
  "NOT_YET_RELEASED",
  "CANCELLED",
  "HIATUS"
)

const AniListMediaFormat = Schema.Literal(
  "TV",
  "TV_SHORT",
  "MOVIE",
  "SPECIAL",
  "OVA",
  "ONA",
  "MUSIC",
  "MANGA",
  "NOVEL",
  "ONE_SHOT"
)

const AniListMedia = Schema.Struct({
  id: PositiveInt,
  idMal: Schema.NullOr(PositiveInt),
  type: Schema.optional(Schema.NullOr(Schema.Literal("ANIME", "MANGA"))),
  title: Schema.NullOr(AniListTitle),
  format: Schema.NullOr(AniListMediaFormat),
  status: Schema.NullOr(AniListMediaStatus),
  episodes: Schema.NullOr(PositiveInt),
  duration: Schema.NullOr(PositiveInt),
  coverImage: Schema.NullOr(AniListCover),
  bannerImage: NullableString,
  genres: Schema.NullOr(Schema.Array(Schema.String)),
  averageScore: NullableInt,
  popularity: NullableInt,
  trending: NullableInt,
  season: Schema.NullOr(Schema.Literal("WINTER", "SPRING", "SUMMER", "FALL")),
  seasonYear: NullableInt,
  nextAiringEpisode: Schema.NullOr(AniListNextEpisode),
  isAdult: Schema.NullOr(Schema.Boolean),
})
type AniListMedia = typeof AniListMedia.Type

export const AniListPageResponse = Schema.Struct({
  data: Schema.NullOr(
    Schema.Struct({
      Page: Schema.NullOr(
        Schema.Struct({
          pageInfo: Schema.NullOr(
            Schema.Struct({ hasNextPage: Schema.NullOr(Schema.Boolean) })
          ),
          media: Schema.NullOr(Schema.Array(Schema.NullOr(AniListMedia))),
        })
      ),
    })
  ),
  errors: Schema.optional(Schema.Array(AniListGraphQlError)),
})

const AniListStudioCatalogResponse = Schema.Struct({
  data: Schema.NullOr(
    Schema.Struct({
      Studio: Schema.NullOr(
        Schema.Struct({
          media: Schema.NullOr(
            Schema.Struct({
              pageInfo: Schema.NullOr(
                Schema.Struct({ hasNextPage: Schema.NullOr(Schema.Boolean) })
              ),
              nodes: Schema.NullOr(Schema.Array(Schema.NullOr(AniListMedia))),
            })
          ),
        })
      ),
    })
  ),
  errors: Schema.optional(Schema.Array(AniListGraphQlError)),
})

const AniListRelation = Schema.Struct({
  relationType: Schema.NullOr(Schema.String),
  node: Schema.NullOr(AniListMedia),
})

const AniListDetailMedia = Schema.Struct({
  ...AniListMedia.fields,
  description: NullableString,
  synonyms: Schema.NullOr(Schema.Array(Schema.String)),
  tags: Schema.NullOr(
    Schema.Array(
      Schema.Struct({
        name: Schema.String,
        rank: Schema.optional(Schema.Int),
        isMediaSpoiler: Schema.optional(Schema.Boolean),
      })
    )
  ),
  studios: Schema.NullOr(
    Schema.Struct({
      nodes: Schema.NullOr(
        Schema.Array(
          Schema.NullOr(
            Schema.Struct({
              name: Schema.String,
              isAnimationStudio: Schema.NullOr(Schema.Boolean),
            })
          )
        )
      ),
    })
  ),
  trailer: Schema.NullOr(
    Schema.Struct({
      site: Schema.String,
      id: Schema.String,
      thumbnail: NullableString,
    })
  ),
  relations: Schema.NullOr(
    Schema.Struct({
      edges: Schema.NullOr(Schema.Array(Schema.NullOr(AniListRelation))),
    })
  ),
  externalLinks: Schema.NullOr(
    Schema.Array(
      Schema.NullOr(
        Schema.Struct({
          site: Schema.String,
          url: Schema.String,
          type: NullableString,
        })
      )
    )
  ),
})

export const AniListDetailResponse = Schema.Struct({
  data: Schema.NullOr(
    Schema.Struct({ Media: Schema.NullOr(AniListDetailMedia) })
  ),
  errors: Schema.optional(Schema.Array(AniListGraphQlError)),
})

export const AniListDetailsResponse = Schema.Struct({
  data: Schema.NullOr(
    Schema.Struct({
      Page: Schema.NullOr(
        Schema.Struct({
          media: Schema.NullOr(Schema.Array(Schema.NullOr(AniListDetailMedia))),
        })
      ),
    })
  ),
  errors: Schema.optional(Schema.Array(AniListGraphQlError)),
})

export const AniListRecommendationsResponse = Schema.Struct({
  data: Schema.NullOr(
    Schema.Struct({
      Media: Schema.NullOr(
        Schema.Struct({
          recommendations: Schema.NullOr(
            Schema.Struct({
              pageInfo: Schema.NullOr(
                Schema.Struct({ hasNextPage: Schema.NullOr(Schema.Boolean) })
              ),
              nodes: Schema.NullOr(
                Schema.Array(
                  Schema.NullOr(
                    Schema.Struct({
                      mediaRecommendation: Schema.NullOr(AniListMedia),
                    })
                  )
                )
              ),
            })
          ),
        })
      ),
    })
  ),
  errors: Schema.optional(Schema.Array(AniListGraphQlError)),
})

export const AniListScheduleResponse = Schema.Struct({
  data: Schema.NullOr(
    Schema.Struct({
      Page: Schema.NullOr(
        Schema.Struct({
          pageInfo: Schema.NullOr(
            Schema.Struct({ hasNextPage: Schema.NullOr(Schema.Boolean) })
          ),
          airingSchedules: Schema.NullOr(
            Schema.Array(
              Schema.NullOr(
                Schema.Struct({
                  episode: Schema.NullOr(PositiveInt),
                  airingAt: Schema.NullOr(PositiveInt),
                  media: Schema.NullOr(AniListMedia),
                })
              )
            )
          ),
        })
      ),
    })
  ),
  errors: Schema.optional(Schema.Array(AniListGraphQlError)),
})

const AniListMediaList = Schema.NullOr(
  Schema.Struct({
    media: Schema.NullOr(
      Schema.Array(
        Schema.NullOr(
          Schema.Struct({
            ...AniListMedia.fields,
            description: Schema.optional(NullableString),
          })
        )
      )
    ),
  })
)

export const AniListHomeResponse = Schema.Struct({
  data: Schema.NullOr(
    Schema.Struct({
      trending: AniListMediaList,
      seasonal: AniListMediaList,
      topRated: AniListMediaList,
      popular: AniListMediaList,
      upcoming: AniListMediaList,
    })
  ),
  errors: Schema.optional(Schema.Array(AniListGraphQlError)),
})

const AniListScheduleList = Schema.NullOr(
  Schema.Struct({
    airingSchedules: Schema.NullOr(
      Schema.Array(
        Schema.NullOr(
          Schema.Struct({
            episode: Schema.NullOr(PositiveInt),
            airingAt: Schema.NullOr(PositiveInt),
            media: Schema.NullOr(AniListMedia),
          })
        )
      )
    ),
  })
)

export const AniListRecentScheduleResponse = Schema.Struct({
  data: Schema.NullOr(
    Schema.Struct({ first: AniListScheduleList, second: AniListScheduleList })
  ),
  errors: Schema.optional(Schema.Array(AniListGraphQlError)),
})

export const AniListAiringStatusResponse = Schema.Struct({
  data: Schema.NullOr(
    Schema.Struct({
      Page: Schema.NullOr(
        Schema.Struct({
          media: Schema.NullOr(
            Schema.Array(
              Schema.NullOr(
                Schema.Struct({
                  idMal: Schema.NullOr(PositiveInt),
                  status: Schema.NullOr(AniListMediaStatus),
                  episodes: NullableInt,
                  nextAiringEpisode: Schema.NullOr(AniListNextEpisode),
                })
              )
            )
          ),
        })
      ),
    })
  ),
  errors: Schema.optional(Schema.Array(AniListGraphQlError)),
})

export type AniListAiringStatus = {
  malId: number
  status: typeof AniListMediaStatus.Type | null
  episodes: number | null
  nextAiringEpisode: { episode: number; airingAt: number } | null
}

const airingStatusQuery = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(idMal_in: $ids, type: ANIME) {
        idMal status episodes nextAiringEpisode { episode airingAt }
      }
    }
  }
`

const listFields = `
  id idMal type title { romaji english } format status episodes duration
  coverImage { extraLarge large medium } bannerImage genres averageScore
  popularity trending season seasonYear nextAiringEpisode { episode airingAt } isAdult
`

const catalogQuery = `
  query Catalog($page:Int!,$perPage:Int!,$search:String,$sort:[MediaSort],$status:MediaStatus,$format:MediaFormat,$genres:[String],$season:MediaSeason,$seasonYear:Int,$minScore:Int,$maxScore:Int) {
    Page(page:$page,perPage:$perPage) {
      pageInfo { hasNextPage }
      media(type:ANIME,isAdult:false,idMal_not:null,format_not:MUSIC,search:$search,sort:$sort,status:$status,format:$format,genre_in:$genres,season:$season,seasonYear:$seasonYear,averageScore_greater:$minScore,averageScore_lesser:$maxScore) { ${listFields} }
    }
  }
`

const studioCatalogQuery = `
  query StudioCatalog($studio:String!,$page:Int!,$perPage:Int!,$sort:[MediaSort]) {
    Studio(search:$studio) {
      media(isMain:true,page:$page,perPage:$perPage,sort:$sort) {
        pageInfo { hasNextPage }
        nodes { ${listFields} }
      }
    }
  }
`

const detailFields = `
  ${listFields}
  description(asHtml:false) synonyms tags { name rank isMediaSpoiler }
  studios { nodes { name isAnimationStudio } }
  trailer { site id thumbnail }
  relations { edges { relationType(version:2) node { ${listFields} } } }
  externalLinks { site url type }
`

const detailQuery = `
  query Detail($malId:Int!) {
    Media(type:ANIME,idMal:$malId) { ${detailFields} }
  }
`

const detailsQuery = `
  query Details($ids:[Int]) {
    Page(page:1,perPage:50) {
      media(idMal_in:$ids,type:ANIME) { ${detailFields} }
    }
  }
`

const recommendationsQuery = `
  query Recommendations($malId:Int!,$page:Int!,$perPage:Int!) {
    Media(type:ANIME,idMal:$malId) {
      recommendations(page:$page,perPage:$perPage,sort:RATING_DESC) {
        pageInfo { hasNextPage }
        nodes { mediaRecommendation { ${listFields} } }
      }
    }
  }
`

const scheduleQuery = `
  query Schedule($page:Int!,$perPage:Int!,$from:Int!,$to:Int!) {
    Page(page:$page,perPage:$perPage) {
      pageInfo { hasNextPage }
      airingSchedules(airingAt_greater:$from,airingAt_lesser:$to,sort:TIME) {
        episode airingAt media { ${listFields} }
      }
    }
  }
`

const catalogFilter = "type:ANIME,isAdult:false,idMal_not:null,format_not:MUSIC"

// One request for every home row; aliases keep each list separate.
const homeQuery = `
  query Home($season:MediaSeason,$seasonYear:Int) {
    trending: Page(page:1,perPage:10) {
      media(${catalogFilter},sort:[TRENDING_DESC]) { ${listFields} description(asHtml:false) }
    }
    seasonal: Page(page:1,perPage:20) {
      media(${catalogFilter},season:$season,seasonYear:$seasonYear,sort:[POPULARITY_DESC]) { ${listFields} }
    }
    topRated: Page(page:1,perPage:20) {
      media(${catalogFilter},sort:[SCORE_DESC]) { ${listFields} }
    }
    popular: Page(page:1,perPage:20) {
      media(${catalogFilter},sort:[POPULARITY_DESC]) { ${listFields} }
    }
    upcoming: Page(page:1,perPage:10) {
      media(${catalogFilter},status:NOT_YET_RELEASED,sort:[START_DATE_DESC]) { ${listFields} }
    }
  }
`

const itemsQuery = `
  query Items($ids:[Int]) {
    Page(page:1,perPage:50) {
      pageInfo { hasNextPage }
      media(idMal_in:$ids,type:ANIME) { ${listFields} }
    }
  }
`

const recentScheduleQuery = `
  query RecentSchedule($from:Int!,$to:Int!) {
    first: Page(page:1,perPage:50) {
      airingSchedules(airingAt_greater:$from,airingAt_lesser:$to,sort:TIME) {
        episode airingAt media { ${listFields} }
      }
    }
    second: Page(page:2,perPage:50) {
      airingSchedules(airingAt_greater:$from,airingAt_lesser:$to,sort:TIME) {
        episode airingAt media { ${listFields} }
      }
    }
  }
`

const currentSeason = (now: Date): AnimeSeason => {
  const month = now.getUTCMonth()
  if (month < 3) return "WINTER"
  if (month < 6) return "SPRING"
  if (month < 9) return "SUMMER"
  return "FALL"
}

const firstText = (...values: ReadonlyArray<string | null | undefined>) =>
  values.map((value) => value?.trim()).find((value) => Boolean(value)) ?? null

const toAnimeFormat = (format: AniListMedia["format"]): AnimeItem["format"] => {
  if (format === "TV") return "TV"
  if (format === "TV_SHORT") return "TV_SHORT"
  if (format === "MOVIE") return "MOVIE"
  if (format === "SPECIAL") return "SPECIAL"
  if (format === "OVA") return "OVA"
  if (format === "ONA") return "ONA"
  if (format === "MUSIC") return "MUSIC"
  return null
}

const mapMedia = (media: AniListMedia): AnimeItem | null => {
  const malId = media.idMal
  const romaji = firstText(media.title?.romaji, media.title?.english)
  const format = toAnimeFormat(media.format)
  if (!malId || !romaji || media.isAdult) return null
  if (media.type && media.type !== "ANIME") return null
  if (format === "MUSIC" || (media.format && !format)) return null

  return {
    malId,
    aniListId: media.id,
    title: { romaji, english: firstText(media.title?.english) },
    format,
    status: media.status,
    episodes: media.episodes,
    duration: media.duration,
    coverImage: firstText(
      media.coverImage?.extraLarge,
      media.coverImage?.large,
      media.coverImage?.medium
    ),
    bannerImage: media.bannerImage,
    genres: media.genres ?? [],
    averageScore: media.averageScore,
    popularity: media.popularity,
    trending: media.trending,
    season: media.season,
    seasonYear: media.seasonYear,
    broadcast: null,
    nextAiringEpisode: media.nextAiringEpisode,
    isAdult: false,
  }
}

const mapMediaList = (
  media: ReadonlyArray<AniListMedia | null> | null | undefined
) =>
  (media ?? []).flatMap((item) => {
    if (!item) return []
    const mapped = mapMedia(item)
    return mapped ? [mapped] : []
  })

type AniListSchedule = {
  readonly episode: number | null
  readonly airingAt: number | null
  readonly media: AniListMedia | null
}

const scheduleItems = (
  schedules: ReadonlyArray<AniListSchedule | null> | null | undefined
) =>
  (schedules ?? []).flatMap((schedule) => {
    if (!schedule?.media) return []
    const item = mapMedia(schedule.media)
    if (!item) return []
    return [
      {
        ...item,
        nextAiringEpisode:
          schedule.episode && schedule.airingAt
            ? { episode: schedule.episode, airingAt: schedule.airingAt }
            : item.nextAiringEpisode,
      },
    ]
  })

const decodeDetail = (media: typeof AniListDetailMedia.Type) => {
  const item = mapMedia(media)
  if (!item) return Effect.succeed(null)
  const detail: AnimeDetail = {
    ...item,
    description: media.description,
    synonyms: media.synonyms ?? [],
    tags: (media.tags ?? [])
      .filter((tag) => !tag.isMediaSpoiler)
      .sort((left, right) => (right.rank ?? 0) - (left.rank ?? 0))
      .map((tag) => tag.name),
    studios: (media.studios?.nodes ?? []).flatMap((studio) =>
      studio?.isAnimationStudio ? [studio.name] : []
    ),
    trailer: media.trailer,
    relations: (media.relations?.edges ?? []).flatMap((relation) => {
      if (!relation?.node || relation.node.isAdult) return []
      const related = mapMedia(relation.node)
      if (!related) return []
      return [
        {
          malId: related.malId,
          aniListId: related.aniListId,
          relationType: relation.relationType ?? "OTHER",
          title: related.title,
          format: related.format,
          status: related.status,
          coverImage: related.coverImage,
        },
      ]
    }),
    externalLinks: (media.externalLinks ?? []).flatMap((link) =>
      link ? [{ site: link.site, url: link.url, type: link.type }] : []
    ),
  }
  return Schema.decode(AnimeDetailSchema)(detail).pipe(
    Effect.mapError(
      (cause) =>
        new AniListRequestError({
          message: "AniList detail was invalid.",
          cause,
        })
    )
  )
}

const pageFromMedia = (
  media: ReadonlyArray<AniListMedia | null> | null | undefined,
  page: number,
  perPage: number,
  hasNextPage: boolean | null | undefined
): AnimePage => ({
  items: mapMediaList(media),
  page,
  perPage,
  hasNextPage: Boolean(hasNextPage),
})

const anilistSort = (sort: AnimeSort, hasSearch: boolean) => {
  if (sort === "relevance")
    return hasSearch ? ["SEARCH_MATCH", "POPULARITY_DESC"] : ["POPULARITY_DESC"]
  if (sort === "score") return ["SCORE_DESC"]
  if (sort === "trending") return ["TRENDING_DESC"]
  if (sort === "newest") return ["START_DATE_DESC"]
  if (sort === "title") return ["TITLE_ROMAJI"]
  if (sort === "episodes") return ["EPISODES_DESC"]
  if (sort === "favorites") return ["FAVOURITES_DESC"]
  return ["POPULARITY_DESC"]
}

const anilistStatus = (status?: AnimeCatalogStatus) => {
  if (status === "airing") return "RELEASING"
  if (status === "complete") return "FINISHED"
  if (status === "upcoming") return "NOT_YET_RELEASED"
  return undefined
}

export type AnimeCatalogRequest = {
  query?: string
  page: number
  perPage: number
  sort: AnimeSort
  status?: AnimeCatalogStatus
  format?: AnimeFormat
  genres?: ReadonlyArray<string>
  season?: AnimeSeason
  seasonYear?: number
  rating?: AnimeRating
  minScore?: number
  maxScore?: number
  studio?: string
}

export class AniListAnimeService extends Effect.Service<AniListAnimeService>()(
  "@animekaiser/core/AniListAnimeService",
  {
    accessors: true,
    dependencies: [FetchHttpClient.layer],
    scoped: Effect.gen(function* () {
      const http = (yield* HttpClient.HttpClient).pipe(
        HttpClient.withTracerPropagation(false)
      )

      // AniList limits per IP: 30 req/min while it is "degraded" (its
      // X-RateLimit-Remaining header still reports the normal 90), plus an
      // undocumented burst limiter. Every catalog request goes through one
      // queue that stays under both.
      const perMinute = yield* RateLimiter.make({
        limit: 25,
        interval: "1 minute",
      })
      const spacing = yield* RateLimiter.make({
        limit: 1,
        interval: "400 millis",
      })
      const inFlight = yield* Effect.makeSemaphore(2)
      const throttle = <A, E>(effect: Effect.Effect<A, E>) =>
        perMinute(spacing(inFlight.withPermits(1)(effect)))

      let blockedUntil = 0

      const trackRateLimit = (
        response: HttpClientResponse.HttpClientResponse
      ) =>
        Effect.sync(() => {
          if (response.status !== 429) return
          const reset = Number(response.headers["x-ratelimit-reset"])
          const retryAfter = Number(response.headers["retry-after"])
          blockedUntil = Number.isFinite(reset)
            ? reset * 1000
            : Date.now() +
              (Number.isFinite(retryAfter) ? retryAfter : 60) * 1000
        })

      const request = <TValue, TEncoded>(
        schema: Schema.Schema<TValue, TEncoded>,
        query: string,
        variables: object
      ) =>
        Effect.suspend(() =>
          Date.now() < blockedUntil
            ? Effect.fail(
                new AniListRequestError({
                  message: "AniList is rate limiting us.",
                })
              )
            : throttle(
                http
                  .execute(
                    HttpClientRequest.post("https://graphql.anilist.co", {
                      headers: { "content-type": "application/json" },
                    }).pipe(
                      HttpClientRequest.bodyUnsafeJson({ query, variables })
                    )
                  )
                  .pipe(Effect.timeout("15 seconds"))
              ).pipe(
                Effect.tap(trackRateLimit),
                Effect.tap(logAniListRateLimit("catalog")),
                Effect.flatMap(HttpClientResponse.filterStatusOk),
                Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
                Effect.mapError(
                  (cause) =>
                    new AniListRequestError({
                      message: "AniList request failed.",
                      cause,
                    })
                )
              )
        )

      const getCatalog = Effect.fn("AniListAnimeService.getCatalog")(function* (
        input: AnimeCatalogRequest
      ) {
        const response = yield* request(AniListPageResponse, catalogQuery, {
          page: input.page,
          perPage: input.perPage,
          search: input.query?.trim() || undefined,
          sort: anilistSort(input.sort, Boolean(input.query?.trim())),
          status: anilistStatus(input.status),
          format: input.format,
          genres: input.genres?.length ? input.genres : undefined,
          season: input.season,
          seasonYear: input.seasonYear,
          minScore:
            input.minScore === undefined
              ? undefined
              : Math.round(input.minScore * 10),
          maxScore:
            input.maxScore === undefined
              ? undefined
              : Math.round(input.maxScore * 10),
        })
        if (response.errors?.length) {
          return yield* new AniListRequestError({
            message: response.errors[0].message,
          })
        }
        return pageFromMedia(
          response.data?.Page?.media,
          input.page,
          input.perPage,
          response.data?.Page?.pageInfo?.hasNextPage
        )
      })

      const getStudioCatalog = Effect.fn(
        "AniListAnimeService.getStudioCatalog"
      )(function* (input: AnimeCatalogRequest & { studio: string }) {
        const response = yield* request(
          AniListStudioCatalogResponse,
          studioCatalogQuery,
          {
            studio: input.studio,
            page: input.page,
            perPage: input.perPage,
            sort: anilistSort(input.sort, false),
          }
        )
        if (response.errors?.length) {
          return yield* new AniListRequestError({
            message: response.errors[0].message,
          })
        }
        const media = response.data?.Studio?.media
        return pageFromMedia(
          media?.nodes,
          input.page,
          input.perPage,
          media?.pageInfo?.hasNextPage
        )
      })

      const getDiscovery = Effect.fn("AniListAnimeService.getDiscovery")(
        function* (
          category: AnimeDiscoveryCategory,
          page: number,
          perPage: number
        ) {
          const now = new Date()
          const season = currentSeason(now)
          const requestInput: AnimeCatalogRequest = {
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
            season: category === "seasonal" ? season : undefined,
            seasonYear:
              category === "seasonal" ? now.getUTCFullYear() : undefined,
          }
          return yield* getCatalog(requestInput)
        }
      )

      const getDetail = Effect.fn("AniListAnimeService.getDetail")(function* (
        malId: number
      ) {
        const response = yield* request(AniListDetailResponse, detailQuery, {
          malId,
        })
        if (response.errors?.length) {
          return yield* new AniListRequestError({
            message: response.errors[0].message,
          })
        }
        const media = response.data?.Media
        return media ? yield* decodeDetail(media) : null
      })

      // Full details for up to 50 MAL ids in one request.
      const getDetails = Effect.fn("AniListAnimeService.getDetails")(function* (
        malIds: ReadonlyArray<number>
      ) {
        if (malIds.length === 0) return []
        const response = yield* request(AniListDetailsResponse, detailsQuery, {
          ids: malIds.slice(0, 50),
        })
        if (response.errors?.length) {
          return yield* new AniListRequestError({
            message: response.errors[0].message,
          })
        }
        const details = yield* Effect.forEach(
          response.data?.Page?.media ?? [],
          (media) => (media ? decodeDetail(media) : Effect.succeed(null))
        )
        return details.filter((detail) => detail !== null)
      })

      const getRecommendations = Effect.fn(
        "AniListAnimeService.getRecommendations"
      )(function* (malId: number, page: number, perPage: number) {
        const response = yield* request(
          AniListRecommendationsResponse,
          recommendationsQuery,
          {
            malId,
            page,
            perPage,
          }
        )
        if (response.errors?.length) {
          return yield* new AniListRequestError({
            message: response.errors[0].message,
          })
        }
        const recommendations = response.data?.Media?.recommendations
        return yield* Schema.decode(AnimePageSchema)(
          pageFromMedia(
            (recommendations?.nodes ?? []).map(
              (node) => node?.mediaRecommendation ?? null
            ),
            page,
            perPage,
            recommendations?.pageInfo?.hasNextPage
          )
        ).pipe(
          Effect.mapError(
            (cause) =>
              new AniListRequestError({
                message: "AniList recommendations were invalid.",
                cause,
              })
          )
        )
      })

      const getSchedule = Effect.fn("AniListAnimeService.getSchedule")(
        function* (from: number, to: number, page: number, perPage: number) {
          const response = yield* request(
            AniListScheduleResponse,
            scheduleQuery,
            {
              from,
              to,
              page,
              perPage,
            }
          )
          if (response.errors?.length) {
            return yield* new AniListRequestError({
              message: response.errors[0].message,
            })
          }
          const items = scheduleItems(response.data?.Page?.airingSchedules)
          return {
            items,
            page,
            perPage,
            hasNextPage: Boolean(response.data?.Page?.pageInfo?.hasNextPage),
          }
        }
      )

      const getHome = Effect.fn("AniListAnimeService.getHome")(function* () {
        const now = new Date()
        const response = yield* request(AniListHomeResponse, homeQuery, {
          season: currentSeason(now),
          seasonYear: now.getUTCFullYear(),
        })
        if (response.errors?.length || !response.data) {
          return yield* new AniListRequestError({
            message: response.errors?.[0]?.message ?? "AniList home was empty.",
          })
        }
        const { trending, seasonal, topRated, popular, upcoming } =
          response.data
        return {
          trending: (trending?.media ?? []).flatMap((media) => {
            const item = media ? mapMedia(media) : null
            return item && media
              ? [{ ...item, description: media.description ?? null }]
              : []
          }),
          seasonal: mapMediaList(seasonal?.media),
          topRated: mapMediaList(topRated?.media),
          popular: mapMediaList(popular?.media),
          upcoming: mapMediaList(upcoming?.media),
        }
      })

      // Card data for up to 50 MAL ids in one request; ids AniList doesn't
      // know are simply missing from the result.
      const getItems = Effect.fn("AniListAnimeService.getItems")(function* (
        malIds: ReadonlyArray<number>
      ) {
        if (malIds.length === 0) return []
        const response = yield* request(AniListPageResponse, itemsQuery, {
          ids: malIds.slice(0, 50),
        })
        if (response.errors?.length) {
          return yield* new AniListRequestError({
            message: response.errors[0].message,
          })
        }
        return mapMediaList(response.data?.Page?.media)
      })

      const getRecentSchedule = Effect.fn(
        "AniListAnimeService.getRecentSchedule"
      )(function* (from: number, to: number) {
        const response = yield* request(
          AniListRecentScheduleResponse,
          recentScheduleQuery,
          { from, to }
        )
        if (response.errors?.length) {
          return yield* new AniListRequestError({
            message: response.errors[0].message,
          })
        }
        return [
          ...scheduleItems(response.data?.first?.airingSchedules),
          ...scheduleItems(response.data?.second?.airingSchedules),
        ]
      })

      // AniList caps a page at 50 media, so callers batch MAL ids in 50s.
      const getAiringStatus = Effect.fn("AniListAnimeService.getAiringStatus")(
        function* (malIds: ReadonlyArray<number>) {
          const response = yield* request(
            AniListAiringStatusResponse,
            airingStatusQuery,
            { ids: malIds.slice(0, 50) }
          )
          if (response.errors?.length) {
            return yield* new AniListRequestError({
              message: response.errors[0].message,
            })
          }
          return (response.data?.Page?.media ?? []).flatMap(
            (media): Array<AniListAiringStatus> =>
              media?.idMal
                ? [
                    {
                      malId: media.idMal,
                      status: media.status,
                      episodes: media.episodes,
                      nextAiringEpisode: media.nextAiringEpisode,
                    },
                  ]
                : []
          )
        }
      )

      return {
        getCatalog,
        getStudioCatalog,
        getDiscovery,
        getHome,
        getItems,
        getDetail,
        getDetails,
        getRecommendations,
        getSchedule,
        getRecentSchedule,
        getAiringStatus,
      }
    }),
  }
) {}
