import {
  AnimeDiscoveryCategory,
  AnimeFormat,
  AnimeRating,
  AnimeScheduleDay,
  AnimeSeason,
  AnimeSort,
} from "@workspace/domain"
import * as Schema from "effect/Schema"
import { getTodayScheduleDay } from "./schedule"

export const DEFAULT_CATALOG_PER_PAGE = 24

const PositivePage = Schema.Union(Schema.Number, Schema.NumberFromString).pipe(
  Schema.int(),
  Schema.positive()
)

const Score = Schema.Union(Schema.Number, Schema.NumberFromString).pipe(
  Schema.between(0, 10)
)

const SeasonYear = Schema.Union(Schema.Number, Schema.NumberFromString).pipe(
  Schema.int(),
  Schema.between(1900, 2200)
)

export const CatalogSearch = Schema.Struct({
  q: Schema.optional(Schema.String),
  page: Schema.optionalWith(PositivePage, { default: () => 1 }),
  sort: Schema.optionalWith(AnimeSort, { default: () => "popularity" }),
  status: Schema.optional(Schema.Literal("airing", "complete", "upcoming")),
  format: Schema.optional(AnimeFormat),
  genre: Schema.optional(Schema.String),
  season: Schema.optional(AnimeSeason),
  seasonYear: Schema.optional(SeasonYear),
  rating: Schema.optional(AnimeRating),
  minScore: Schema.optional(Score),
  maxScore: Schema.optional(Score),
})
export type CatalogSearch = typeof CatalogSearch.Type

export const DiscoverSearch = Schema.Struct({
  tab: Schema.optionalWith(AnimeDiscoveryCategory, {
    default: () => "trending",
  }),
  page: Schema.optionalWith(PositivePage, { default: () => 1 }),
})
export type DiscoverSearch = typeof DiscoverSearch.Type

export const ScheduleSearch = Schema.Struct({
  day: Schema.optionalWith(AnimeScheduleDay, {
    default: getTodayScheduleDay,
  }),
})
export type ScheduleSearch = typeof ScheduleSearch.Type

export const decodeCatalogSearch = Schema.decodeUnknownSync(CatalogSearch)
export const decodeDiscoverSearch = Schema.decodeUnknownSync(DiscoverSearch)
export const decodeScheduleSearch = Schema.decodeUnknownSync(ScheduleSearch)

export const catalogInput = (search: CatalogSearch) => ({
  query: search.q?.trim() || undefined,
  page: search.page,
  perPage: DEFAULT_CATALOG_PER_PAGE,
  sort: search.sort,
  status: search.status,
  format: search.format,
  genres: search.genre
    ?.split(",")
    .map((genre) => genre.trim())
    .filter(Boolean),
  season: search.season,
  seasonYear: search.seasonYear,
  rating: search.rating,
  minScore: search.minScore,
  maxScore: search.maxScore,
})
