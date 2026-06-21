import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
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
} from "@workspace/domain"
import {
  AnimeDetail as AnimeDetailSchema,
  AnimePage as AnimePageSchema,
} from "@workspace/domain"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

export class AniListRequestError extends Schema.TaggedError<AniListRequestError>()(
  "AniListRequestError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}

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

const AniListMedia = Schema.Struct({
  id: PositiveInt,
  idMal: Schema.NullOr(PositiveInt),
  title: Schema.NullOr(AniListTitle),
  format: Schema.NullOr(
    Schema.Literal("TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA", "MUSIC")
  ),
  status: Schema.NullOr(
    Schema.Literal("FINISHED", "RELEASING", "NOT_YET_RELEASED", "CANCELLED", "HIATUS")
  ),
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

const AniListPageResponse = Schema.Struct({
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
    Schema.Struct({ site: Schema.String, id: Schema.String, thumbnail: NullableString })
  ),
  relations: Schema.NullOr(
    Schema.Struct({ edges: Schema.NullOr(Schema.Array(Schema.NullOr(AniListRelation))) })
  ),
  externalLinks: Schema.NullOr(
    Schema.Array(
      Schema.NullOr(
        Schema.Struct({ site: Schema.String, url: Schema.String, type: NullableString })
      )
    )
  ),
})

const AniListDetailResponse = Schema.Struct({
  data: Schema.NullOr(Schema.Struct({ Media: Schema.NullOr(AniListDetailMedia) })),
  errors: Schema.optional(Schema.Array(AniListGraphQlError)),
})

const AniListRecommendationsResponse = Schema.Struct({
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
                    Schema.Struct({ mediaRecommendation: Schema.NullOr(AniListMedia) })
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

const AniListScheduleResponse = Schema.Struct({
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

const listFields = `
  id idMal title { romaji english } format status episodes duration
  coverImage { extraLarge large medium } bannerImage genres averageScore
  popularity trending season seasonYear nextAiringEpisode { episode airingAt } isAdult
`

const catalogQuery = `
  query Catalog($page:Int!,$perPage:Int!,$search:String,$sort:[MediaSort],$status:MediaStatus,$format:MediaFormat,$genres:[String],$season:MediaSeason,$seasonYear:Int,$minScore:Int,$maxScore:Int) {
    Page(page:$page,perPage:$perPage) {
      pageInfo { hasNextPage }
      media(type:ANIME,isAdult:false,idMal_not:null,search:$search,sort:$sort,status:$status,format:$format,genre_in:$genres,season:$season,seasonYear:$seasonYear,averageScore_greater:$minScore,averageScore_lesser:$maxScore) { ${listFields} }
    }
  }
`

const detailQuery = `
  query Detail($malId:Int!) {
    Media(type:ANIME,idMal:$malId) {
      ${listFields}
      description(asHtml:false) synonyms tags { name rank isMediaSpoiler }
      studios { nodes { name isAnimationStudio } }
      trailer { site id thumbnail }
      relations { edges { relationType(version:2) node { ${listFields} } } }
      externalLinks { site url type }
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

const firstText = (...values: ReadonlyArray<string | null | undefined>) =>
  values.map((value) => value?.trim()).find((value) => Boolean(value)) ?? null

const mapMedia = (media: AniListMedia): AnimeItem | null => {
  const malId = media.idMal
  const romaji = firstText(media.title?.romaji, media.title?.english)
  if (!malId || !romaji || media.isAdult) return null

  return {
    malId,
    aniListId: media.id,
    title: { romaji, english: firstText(media.title?.english) },
    format: media.format,
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

const pageFromMedia = (
  media: ReadonlyArray<AniListMedia | null> | null | undefined,
  page: number,
  perPage: number,
  hasNextPage: boolean | null | undefined
): AnimePage => ({
  items: (media ?? []).flatMap((item) => {
    if (!item) return []
    const mapped = mapMedia(item)
    return mapped ? [mapped] : []
  }),
  page,
  perPage,
  hasNextPage: Boolean(hasNextPage),
})

const anilistSort = (sort: AnimeSort, hasSearch: boolean) => {
  if (sort === "relevance") return hasSearch ? ["SEARCH_MATCH", "POPULARITY_DESC"] : ["POPULARITY_DESC"]
  if (sort === "score") return ["SCORE_DESC"]
  if (sort === "trending") return ["TRENDING_DESC"]
  if (sort === "newest") return ["START_DATE_DESC"]
  if (sort === "title") return ["TITLE_ROMAJI"]
  if (sort === "episodes") return ["EPISODES_DESC"]
  if (sort === "favorites") return ["FAVOURITES_DESC"]
  return ["POPULARITY_DESC"]
}

const anilistStatus = (status?: typeof AnimeCatalogStatus.Type) => {
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
  status?: typeof AnimeCatalogStatus.Type
  format?: AnimeFormat
  genres?: ReadonlyArray<string>
  season?: AnimeSeason
  seasonYear?: number
  rating?: typeof AnimeRating.Type
  minScore?: number
  maxScore?: number
}

export class AniListAnimeService extends Effect.Service<AniListAnimeService>()(
  "@workspace/core/server/AniListAnimeService",
  {
    accessors: true,
    dependencies: [FetchHttpClient.layer],
    effect: Effect.gen(function* () {
      const http = (yield* HttpClient.HttpClient).pipe(HttpClient.withTracerPropagation(false))

      const request = <TValue, TEncoded>(
        schema: Schema.Schema<TValue, TEncoded>,
        query: string,
        variables: object
      ) =>
        http
          .execute(
            HttpClientRequest.post("https://graphql.anilist.co", {
              headers: { "content-type": "application/json" },
            }).pipe(HttpClientRequest.bodyUnsafeJson({ query, variables }))
          )
          .pipe(
            Effect.flatMap(HttpClientResponse.filterStatusOk),
            Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
            Effect.mapError(
              (cause) => new AniListRequestError({ message: "AniList request failed.", cause })
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
          minScore: input.minScore === undefined ? undefined : Math.round(input.minScore * 10),
          maxScore: input.maxScore === undefined ? undefined : Math.round(input.maxScore * 10),
        })
        if (response.errors?.length) {
          return yield* new AniListRequestError({ message: response.errors[0].message })
        }
        return pageFromMedia(
          response.data?.Page?.media,
          input.page,
          input.perPage,
          response.data?.Page?.pageInfo?.hasNextPage
        )
      })

      const getDiscovery = Effect.fn("AniListAnimeService.getDiscovery")(function* (
        category: AnimeDiscoveryCategory,
        page: number,
        perPage: number
      ) {
        const now = new Date()
        const month = now.getUTCMonth()
        const season: AnimeSeason =
          month < 3 ? "WINTER" : month < 6 ? "SPRING" : month < 9 ? "SUMMER" : "FALL"
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
          seasonYear: category === "seasonal" ? now.getUTCFullYear() : undefined,
        }
        return yield* getCatalog(requestInput)
      })

      const getDetail = Effect.fn("AniListAnimeService.getDetail")(function* (malId: number) {
        const response = yield* request(AniListDetailResponse, detailQuery, { malId })
        if (response.errors?.length) {
          return yield* new AniListRequestError({ message: response.errors[0].message })
        }
        const media = response.data?.Media
        const item = media ? mapMedia(media) : null
        if (!media || !item) return null
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
        return yield* Schema.decode(AnimeDetailSchema)(detail).pipe(
          Effect.mapError(
            (cause) =>
              new AniListRequestError({ message: "AniList detail was invalid.", cause })
          )
        )
      })

      const getRecommendations = Effect.fn("AniListAnimeService.getRecommendations")(
        function* (malId: number, page: number, perPage: number) {
          const response = yield* request(AniListRecommendationsResponse, recommendationsQuery, {
            malId,
            page,
            perPage,
          })
          if (response.errors?.length) {
            return yield* new AniListRequestError({ message: response.errors[0].message })
          }
          const recommendations = response.data?.Media?.recommendations
          return yield* Schema.decode(AnimePageSchema)(
            pageFromMedia(
              (recommendations?.nodes ?? []).map((node) => node?.mediaRecommendation ?? null),
              page,
              perPage,
              recommendations?.pageInfo?.hasNextPage
            )
          ).pipe(
            Effect.mapError(
              (cause) =>
                new AniListRequestError({ message: "AniList recommendations were invalid.", cause })
            )
          )
        }
      )

      const getSchedule = Effect.fn("AniListAnimeService.getSchedule")(function* (
        from: number,
        to: number,
        page: number,
        perPage: number
      ) {
        const response = yield* request(AniListScheduleResponse, scheduleQuery, {
          from,
          to,
          page,
          perPage,
        })
        if (response.errors?.length) {
          return yield* new AniListRequestError({ message: response.errors[0].message })
        }
        const schedules = response.data?.Page?.airingSchedules ?? []
        const items = schedules.flatMap((schedule) => {
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
        return { items, page, perPage, hasNextPage: Boolean(response.data?.Page?.pageInfo?.hasNextPage) }
      })

      return { getCatalog, getDiscovery, getDetail, getRecommendations, getSchedule }
    }),
  }
) {}
