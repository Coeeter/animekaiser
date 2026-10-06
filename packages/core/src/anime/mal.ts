import type {
  AnimeDetail,
  AnimeDiscoveryCategory,
  AnimeItem,
  AnimePage,
} from "@animekaiser/domain"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientError from "@effect/platform/HttpClientError"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as RateLimiter from "effect/RateLimiter"
import * as Schema from "effect/Schema"

export class MalApiConfig extends Context.Tag("@animekaiser/core/MalApiConfig")<
  MalApiConfig,
  { readonly clientId: string }
>() {}

export class MalRequestError extends Schema.TaggedError<MalRequestError>()(
  "MalRequestError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}

const NullableString = Schema.NullOr(Schema.String)

const MalPicture = Schema.Struct({
  medium: Schema.optional(Schema.String),
  large: Schema.optional(Schema.String),
})

const MalNode = Schema.Struct({
  id: Schema.Int,
  title: Schema.String,
  main_picture: Schema.optional(MalPicture),
  alternative_titles: Schema.optional(
    Schema.Struct({
      synonyms: Schema.optional(Schema.Array(Schema.String)),
      en: Schema.optional(NullableString),
    })
  ),
  media_type: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
  num_episodes: Schema.optional(Schema.Int),
  average_episode_duration: Schema.optional(Schema.Int),
  mean: Schema.optional(Schema.Number),
  num_list_users: Schema.optional(Schema.Int),
  start_season: Schema.optional(
    Schema.Struct({ year: Schema.Int, season: Schema.String })
  ),
  genres: Schema.optional(Schema.Array(Schema.Struct({ name: Schema.String }))),
  broadcast: Schema.optional(
    Schema.Struct({
      day_of_the_week: Schema.optional(Schema.String),
      start_time: Schema.optional(Schema.String),
    })
  ),
  nsfw: Schema.optional(Schema.String),
  rating: Schema.optional(Schema.String),
})
type MalNode = typeof MalNode.Type

const MalDetail = Schema.Struct({
  ...MalNode.fields,
  synopsis: Schema.optional(Schema.String),
  studios: Schema.optional(
    Schema.Array(Schema.Struct({ name: Schema.String }))
  ),
  related_anime: Schema.optional(
    Schema.Array(
      Schema.Struct({
        node: Schema.Struct({
          id: Schema.Int,
          title: Schema.String,
          main_picture: Schema.optional(MalPicture),
        }),
        relation_type: Schema.String,
      })
    )
  ),
  recommendations: Schema.optional(
    Schema.Array(Schema.Struct({ node: MalNode }))
  ),
})

const MalList = Schema.Struct({
  data: Schema.Array(Schema.Struct({ node: MalNode })),
  paging: Schema.optional(
    Schema.Struct({ next: Schema.optional(Schema.String) })
  ),
})

const itemFields = [
  "alternative_titles",
  "media_type",
  "status",
  "num_episodes",
  "average_episode_duration",
  "mean",
  "num_list_users",
  "start_season",
  "genres",
  "broadcast",
  "nsfw",
  "rating",
].join(",")

const detailFields = [
  itemFields,
  "synopsis",
  "studios",
  "related_anime",
  `recommendations{${itemFields}}`,
].join(",")

const format = (value: string | undefined): AnimeItem["format"] => {
  if (value === "tv") return "TV"
  if (value === "movie") return "MOVIE"
  if (value === "ova") return "OVA"
  if (value === "ona") return "ONA"
  if (value === "special" || value === "tv_special") return "SPECIAL"
  if (value === "music") return "MUSIC"
  return null
}

const status = (value: string | undefined): AnimeItem["status"] => {
  if (value === "currently_airing") return "RELEASING"
  if (value === "finished_airing") return "FINISHED"
  if (value === "not_yet_aired") return "NOT_YET_RELEASED"
  return null
}

const season = (value: string | undefined): AnimeItem["season"] => {
  if (value === "winter") return "WINTER"
  if (value === "spring") return "SPRING"
  if (value === "summer") return "SUMMER"
  if (value === "fall") return "FALL"
  return null
}

const day = (
  value: string | undefined
): NonNullable<AnimeItem["broadcast"]>["day"] => {
  if (value === "sunday") return "sunday"
  if (value === "monday") return "monday"
  if (value === "tuesday") return "tuesday"
  if (value === "wednesday") return "wednesday"
  if (value === "thursday") return "thursday"
  if (value === "friday") return "friday"
  if (value === "saturday") return "saturday"
  return null
}

const positiveOrNull = (value: number | undefined) =>
  value && value > 0 ? value : null

export const mapMalNode = (node: MalNode): AnimeItem | null => {
  const animeFormat = format(node.media_type)
  if (node.rating === "rx" || node.nsfw === "black") return null
  if (animeFormat === "MUSIC") return null
  const broadcastDay = day(node.broadcast?.day_of_the_week)
  const broadcastTime = node.broadcast?.start_time ?? null

  return {
    malId: node.id,
    aniListId: null,
    title: {
      romaji: node.title,
      english: node.alternative_titles?.en?.trim() || null,
    },
    format: animeFormat,
    status: status(node.status),
    episodes: positiveOrNull(node.num_episodes),
    duration: positiveOrNull(
      Math.round((node.average_episode_duration ?? 0) / 60)
    ),
    coverImage: node.main_picture?.large ?? node.main_picture?.medium ?? null,
    bannerImage: null,
    genres: node.genres?.map((genre) => genre.name) ?? [],
    averageScore: node.mean === undefined ? null : Math.round(node.mean * 10),
    popularity: node.num_list_users ?? null,
    trending: null,
    season: season(node.start_season?.season),
    seasonYear: node.start_season?.year ?? null,
    broadcast:
      broadcastDay || broadcastTime
        ? {
            day: broadcastDay,
            time: broadcastTime,
            timezone: "Asia/Tokyo",
            label:
              broadcastDay && broadcastTime
                ? `${broadcastDay[0]?.toUpperCase()}${broadcastDay.slice(1)}s at ${broadcastTime} (JST)`
                : null,
          }
        : null,
    nextAiringEpisode: null,
    isAdult: false,
  }
}

const mapNodes = (nodes: ReadonlyArray<{ node: MalNode }>) =>
  nodes.flatMap(({ node }) => {
    const item = mapMalNode(node)
    return item ? [item] : []
  })

const rankingType = (category: AnimeDiscoveryCategory) => {
  if (category === "trending") return "airing"
  if (category === "topRated") return "all"
  if (category === "upcoming") return "upcoming"
  return "bypopularity"
}

const currentSeason = (now: Date) => {
  const month = now.getUTCMonth()
  if (month < 3) return "winter"
  if (month < 6) return "spring"
  if (month < 9) return "summer"
  return "fall"
}

// MAL's official API, keyed by our own ids. It backs AniList up for data
// both have; it has no trending, banners or per-episode air times.
export class MalAnimeService extends Effect.Service<MalAnimeService>()(
  "@animekaiser/core/MalAnimeService",
  {
    accessors: true,
    dependencies: [FetchHttpClient.layer],
    scoped: Effect.gen(function* () {
      const { clientId } = yield* MalApiConfig
      const http = (yield* HttpClient.HttpClient).pipe(
        HttpClient.withTracerPropagation(false)
      )
      // MAL doesn't publish a limit; stay well under what clients report.
      const limit = yield* RateLimiter.make({
        limit: 2,
        interval: "1 second",
      })

      const get = <TValue, TEncoded>(
        schema: Schema.Schema<TValue, TEncoded>,
        path: string,
        params: Record<string, string>
      ) => {
        const url = new URL(`https://api.myanimelist.net/v2/${path}`)
        for (const [key, value] of Object.entries(params))
          url.searchParams.set(key, value)
        return limit(
          http.execute(
            HttpClientRequest.get(url.toString(), {
              headers: { "x-mal-client-id": clientId },
            })
          )
        ).pipe(
          Effect.timeout("10 seconds"),
          Effect.flatMap(HttpClientResponse.filterStatusOk),
          Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
          Effect.mapError(
            (cause) =>
              new MalRequestError({ message: "MAL request failed.", cause })
          )
        )
      }

      const page = (
        items: ReadonlyArray<AnimeItem>,
        pageNumber: number,
        perPage: number,
        hasNextPage: boolean
      ): AnimePage => ({ items, page: pageNumber, perPage, hasNextPage })

      const getDetail = Effect.fn("MalAnimeService.getDetail")(function* (
        malId: number
      ) {
        const response = yield* get(MalDetail, `anime/${malId}`, {
          fields: detailFields,
        }).pipe(
          Effect.catchIf(
            (error) =>
              HttpClientError.isHttpClientError(error.cause) &&
              error.cause._tag === "ResponseError" &&
              error.cause.response.status === 404,
            () => Effect.succeed(null)
          )
        )
        if (!response) return null
        const item = mapMalNode(response)
        if (!item) return null
        return {
          ...item,
          description: response.synopsis?.trim() || null,
          synonyms: response.alternative_titles?.synonyms ?? [],
          tags: [],
          studios: response.studios?.map((studio) => studio.name) ?? [],
          trailer: null,
          relations: (response.related_anime ?? []).map((related) => ({
            malId: related.node.id,
            aniListId: null,
            relationType: related.relation_type.toUpperCase(),
            title: { romaji: related.node.title, english: null },
            format: null,
            status: null,
            coverImage:
              related.node.main_picture?.large ??
              related.node.main_picture?.medium ??
              null,
          })),
          externalLinks: [],
        } satisfies AnimeDetail
      })

      const getRecommendations = Effect.fn(
        "MalAnimeService.getRecommendations"
      )(function* (malId: number, pageNumber: number, perPage: number) {
        const response = yield* get(MalDetail, `anime/${malId}`, {
          fields: `recommendations{${itemFields}}`,
        })
        const items = mapNodes(response.recommendations ?? [])
        const offset = (pageNumber - 1) * perPage
        return page(
          items.slice(offset, offset + perPage),
          pageNumber,
          perPage,
          items.length > offset + perPage
        )
      })

      const getDiscovery = Effect.fn("MalAnimeService.getDiscovery")(function* (
        category: AnimeDiscoveryCategory,
        pageNumber: number,
        perPage: number
      ) {
        const now = new Date()
        const offset = String((pageNumber - 1) * perPage)
        const response =
          category === "seasonal"
            ? yield* get(
                MalList,
                `anime/season/${now.getUTCFullYear()}/${currentSeason(now)}`,
                {
                  sort: "anime_num_list_users",
                  limit: String(perPage),
                  offset,
                  fields: itemFields,
                }
              )
            : yield* get(MalList, "anime/ranking", {
                ranking_type: rankingType(category),
                limit: String(perPage),
                offset,
                fields: itemFields,
              })
        return page(
          mapNodes(response.data),
          pageNumber,
          perPage,
          Boolean(response.paging?.next)
        )
      })

      // MAL only searches by text (at least 3 characters), with no filters.
      const search = Effect.fn("MalAnimeService.search")(function* (
        query: string,
        pageNumber: number,
        perPage: number
      ) {
        const response = yield* get(MalList, "anime", {
          q: query,
          limit: String(perPage),
          offset: String((pageNumber - 1) * perPage),
          fields: itemFields,
        })
        return page(
          mapNodes(response.data),
          pageNumber,
          perPage,
          Boolean(response.paging?.next)
        )
      })

      return { getDetail, getRecommendations, getDiscovery, search }
    }),
  }
) {}
