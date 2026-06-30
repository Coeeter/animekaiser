import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import type { AnimeDetail, AnimeItem, AnimePage } from "@workspace/domain"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { AnimeCatalogRequest } from "./anilist"

export class JikanRequestError extends Schema.TaggedError<JikanRequestError>()(
  "JikanRequestError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}

const NullableString = Schema.NullOr(Schema.String)
const NullableNumber = Schema.NullOr(Schema.Number)
const JikanNamed = Schema.Struct({ name: Schema.String })

const JikanAnime = Schema.Struct({
  mal_id: Schema.Int.pipe(Schema.positive()),
  title: Schema.String,
  title_english: NullableString,
  title_synonyms: Schema.optional(Schema.Array(Schema.String)),
  type: NullableString,
  status: NullableString,
  episodes: Schema.NullOr(Schema.Int),
  duration: NullableString,
  images: Schema.Struct({
    webp: Schema.Struct({
      large_image_url: NullableString,
      image_url: NullableString,
      small_image_url: NullableString,
    }),
  }),
  trailer: Schema.optional(
    Schema.Struct({
      youtube_id: NullableString,
      images: Schema.NullOr(
        Schema.Struct({ maximum_image_url: NullableString })
      ),
    })
  ),
  genres: Schema.Array(JikanNamed),
  score: NullableNumber,
  members: Schema.optional(NullableNumber),
  season: NullableString,
  year: Schema.NullOr(Schema.Int),
  rating: NullableString,
  synopsis: Schema.optional(NullableString),
  studios: Schema.optional(Schema.Array(JikanNamed)),
  broadcast: Schema.optional(
    Schema.Struct({
      day: NullableString,
      time: NullableString,
      timezone: NullableString,
      string: NullableString,
    })
  ),
  external: Schema.optional(
    Schema.Array(Schema.Struct({ name: Schema.String, url: Schema.String }))
  ),
})
type JikanAnime = typeof JikanAnime.Type

const Pagination = Schema.Struct({ has_next_page: Schema.Boolean })
export const JikanListResponse = Schema.Struct({
  data: Schema.Array(JikanAnime),
  pagination: Pagination,
})
export const JikanDetailResponse = Schema.Struct({ data: JikanAnime })
export const JikanRecommendationResponse = Schema.Struct({
  data: Schema.Array(Schema.Struct({ entry: JikanAnime })),
})

const durationMinutes = (value: string | null) => {
  const match = value?.match(/(\d+)\s*min/i)
  return match ? Number(match[1]) : null
}

const format = (value: string | null): AnimeItem["format"] => {
  if (value === "TV") return "TV"
  if (value === "Movie") return "MOVIE"
  if (value === "OVA") return "OVA"
  if (value === "ONA") return "ONA"
  if (value === "Special") return "SPECIAL"
  if (value === "Music") return "MUSIC"
  return null
}

const status = (value: string | null): AnimeItem["status"] => {
  if (value === "Currently Airing") return "RELEASING"
  if (value === "Finished Airing") return "FINISHED"
  if (value === "Not yet aired") return "NOT_YET_RELEASED"
  return null
}

const season = (value: string | null): AnimeItem["season"] => {
  if (value === "winter") return "WINTER"
  if (value === "spring") return "SPRING"
  if (value === "summer") return "SUMMER"
  if (value === "fall") return "FALL"
  return null
}

const day = (
  value: string | null
): NonNullable<AnimeItem["broadcast"]>["day"] => {
  const normalized = value?.replace(/s$/, "").toLowerCase()
  if (normalized === "sunday") return "sunday"
  if (normalized === "monday") return "monday"
  if (normalized === "tuesday") return "tuesday"
  if (normalized === "wednesday") return "wednesday"
  if (normalized === "thursday") return "thursday"
  if (normalized === "friday") return "friday"
  if (normalized === "saturday") return "saturday"
  return null
}

const mapAnime = (anime: JikanAnime): AnimeItem | null => {
  const animeFormat = format(anime.type)
  if (anime.rating?.startsWith("Rx") || animeFormat === "MUSIC") return null

  return {
    malId: anime.mal_id,
    aniListId: null,
    title: { romaji: anime.title, english: anime.title_english },
    format: animeFormat,
    status: status(anime.status),
    episodes: anime.episodes && anime.episodes > 0 ? anime.episodes : null,
    duration: durationMinutes(anime.duration),
    coverImage:
      anime.images.webp.large_image_url ??
      anime.images.webp.image_url ??
      anime.images.webp.small_image_url,
    bannerImage: null,
    genres: anime.genres.map((genre) => genre.name),
    averageScore: anime.score === null ? null : Math.round(anime.score * 10),
    popularity:
      anime.members === null || anime.members === undefined
        ? null
        : Math.round(anime.members),
    trending: null,
    season: season(anime.season),
    seasonYear: anime.year,
    broadcast: anime.broadcast
      ? {
          day: day(anime.broadcast.day),
          time: anime.broadcast.time,
          timezone: anime.broadcast.timezone,
          label: anime.broadcast.string,
        }
      : null,
    nextAiringEpisode: null,
    isAdult: false,
  }
}

const mapAnimeList = (anime: ReadonlyArray<JikanAnime>) =>
  anime.flatMap((item) => {
    const mapped = mapAnime(item)
    return mapped ? [mapped] : []
  })

const queryUrl = (
  path: string,
  params: Readonly<Record<string, string | number | undefined>>
) => {
  const url = new URL(path, "https://api.jikan.moe/v4/")
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "")
      url.searchParams.set(key, String(value))
  }
  return url.toString()
}

export class JikanAnimeService extends Effect.Service<JikanAnimeService>()(
  "@workspace/core/JikanAnimeService",
  {
    accessors: true,
    dependencies: [FetchHttpClient.layer],
    effect: Effect.gen(function* () {
      const http = (yield* HttpClient.HttpClient).pipe(
        HttpClient.withTracerPropagation(false)
      )
      const get = <TValue, TEncoded>(
        schema: Schema.Schema<TValue, TEncoded>,
        url: string
      ) =>
        http.execute(HttpClientRequest.get(url)).pipe(
          Effect.flatMap(HttpClientResponse.filterStatusOk),
          Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
          Effect.mapError(
            (cause) =>
              new JikanRequestError({ message: "Jikan request failed.", cause })
          )
        )

      const getCatalog = Effect.fn("JikanAnimeService.getCatalog")(function* (
        input: AnimeCatalogRequest
      ) {
        const response = yield* get(
          JikanListResponse,
          queryUrl("anime", {
            sfw: "true",
            genres_exclude: 19,
            q: input.query,
            page: input.page,
            limit: input.perPage,
            order_by:
              input.sort === "score"
                ? "score"
                : input.sort === "title"
                  ? "title"
                  : input.sort === "episodes"
                    ? "episodes"
                    : "members",
            sort: "desc",
            status:
              input.status === "airing"
                ? "airing"
                : input.status === "complete"
                  ? "complete"
                  : input.status === "upcoming"
                    ? "upcoming"
                    : undefined,
            type: input.format?.toLowerCase(),
            rating: input.rating,
            min_score: input.minScore,
            max_score: input.maxScore,
          })
        )
        return {
          items: mapAnimeList(response.data),
          page: input.page,
          perPage: input.perPage,
          hasNextPage: response.pagination.has_next_page,
        } satisfies AnimePage
      })

      const getDetail = Effect.fn("JikanAnimeService.getDetail")(function* (
        malId: number
      ) {
        const response = yield* get(
          JikanDetailResponse,
          `https://api.jikan.moe/v4/anime/${malId}/full`
        )
        const item = mapAnime(response.data)
        if (!item) return null

        return {
          ...item,
          description: response.data.synopsis ?? null,
          synonyms: response.data.title_synonyms ?? [],
          tags: [],
          studios: response.data.studios?.map((studio) => studio.name) ?? [],
          trailer: response.data.trailer?.youtube_id
            ? {
                site: "youtube",
                id: response.data.trailer.youtube_id,
                thumbnail:
                  response.data.trailer.images?.maximum_image_url ?? null,
              }
            : null,
          relations: [],
          externalLinks:
            response.data.external?.map((link) => ({
              site: link.name,
              url: link.url,
              type: null,
            })) ?? [],
        } satisfies AnimeDetail
      })

      const getRecommendations = Effect.fn(
        "JikanAnimeService.getRecommendations"
      )(function* (malId: number, page: number, perPage: number) {
        const response = yield* get(
          JikanRecommendationResponse,
          `https://api.jikan.moe/v4/anime/${malId}/recommendations`
        )
        const items = response.data
          .map((recommendation) => recommendation.entry)
          .slice((page - 1) * perPage, page * perPage)
        const mapped = mapAnimeList(items)
        return {
          items: mapped,
          page,
          perPage,
          hasNextPage: response.data.length > page * perPage,
        }
      })

      const getSchedule = Effect.fn("JikanAnimeService.getSchedule")(function* (
        page: number,
        perPage: number
      ) {
        const response = yield* get(
          JikanListResponse,
          queryUrl("schedules", {
            sfw: "true",
            genres_exclude: 19,
            page,
            limit: perPage,
          })
        )
        return {
          items: mapAnimeList(response.data),
          page,
          perPage,
          hasNextPage: response.pagination.has_next_page,
        }
      })

      return { getCatalog, getDetail, getRecommendations, getSchedule }
    }),
  }
) {}
