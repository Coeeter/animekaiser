import * as Schema from "effect/Schema"

export const MalId = Schema.Int.check(Schema.isGreaterThan(0))
export type MalId = typeof MalId.Type

export const AniListId = Schema.Int.check(Schema.isGreaterThan(0))
export type AniListId = typeof AniListId.Type

export const AnimeTitle = Schema.Struct({
  romaji: Schema.String.check(Schema.isTrimmed(), Schema.isMinLength(1)),
  english: Schema.NullOr(Schema.String),
})
export type AnimeTitle = typeof AnimeTitle.Type

export const AnimeFormat = Schema.Literals([
  "TV",
  "MOVIE",
  "OVA",
  "ONA",
  "SPECIAL",
  "MUSIC",
  "TV_SHORT",
])
export type AnimeFormat = typeof AnimeFormat.Type

export const AnimeReleaseStatus = Schema.Literals([
  "FINISHED",
  "RELEASING",
  "NOT_YET_RELEASED",
  "CANCELLED",
  "HIATUS",
])
export type AnimeReleaseStatus = typeof AnimeReleaseStatus.Type

export const AnimeSeason = Schema.Literals([
  "WINTER",
  "SPRING",
  "SUMMER",
  "FALL",
])
export type AnimeSeason = typeof AnimeSeason.Type

export const AnimeScheduleDay = Schema.Literals([
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
])
export type AnimeScheduleDay = typeof AnimeScheduleDay.Type

export const AnimeBroadcast = Schema.Struct({
  day: Schema.NullOr(AnimeScheduleDay),
  time: Schema.NullOr(Schema.String),
  timezone: Schema.NullOr(Schema.String),
  label: Schema.NullOr(Schema.String),
})

export const AnimeNextAiringEpisode = Schema.Struct({
  episode: Schema.Int.check(Schema.isGreaterThan(0)),
  airingAt: Schema.Int.check(Schema.isGreaterThan(0)),
})

const animeItemFields = {
  malId: MalId,
  aniListId: Schema.NullOr(AniListId),
  title: AnimeTitle,
  format: Schema.NullOr(AnimeFormat),
  status: Schema.NullOr(AnimeReleaseStatus),
  episodes: Schema.NullOr(Schema.Int.check(Schema.isGreaterThan(0))),
  duration: Schema.NullOr(Schema.Int.check(Schema.isGreaterThan(0))),
  coverImage: Schema.NullOr(Schema.String),
  bannerImage: Schema.NullOr(Schema.String),
  genres: Schema.Array(Schema.String),
  averageScore: Schema.NullOr(
    Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 100 }))
  ),
  popularity: Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  trending: Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  season: Schema.NullOr(AnimeSeason),
  seasonYear: Schema.NullOr(
    Schema.Int.check(Schema.isBetween({ minimum: 1900, maximum: 2200 }))
  ),
  broadcast: Schema.NullOr(AnimeBroadcast),
  nextAiringEpisode: Schema.NullOr(AnimeNextAiringEpisode),
  isAdult: Schema.Boolean,
}

export const AnimeItem = Schema.Struct(animeItemFields)
export type AnimeItem = typeof AnimeItem.Type

export const AnimeRelation = Schema.Struct({
  malId: Schema.NullOr(MalId),
  aniListId: Schema.NullOr(AniListId),
  relationType: Schema.String,
  title: AnimeTitle,
  format: Schema.NullOr(AnimeFormat),
  status: Schema.NullOr(AnimeReleaseStatus),
  coverImage: Schema.NullOr(Schema.String),
})

export const AnimeExternalLink = Schema.Struct({
  site: Schema.String,
  url: Schema.String,
  type: Schema.NullOr(Schema.String),
})

export const AnimeTrailer = Schema.Struct({
  site: Schema.String,
  id: Schema.String,
  thumbnail: Schema.NullOr(Schema.String),
})

export const AnimeDetail = Schema.Struct({
  ...animeItemFields,
  description: Schema.NullOr(Schema.String),
  synonyms: Schema.Array(Schema.String),
  tags: Schema.Array(Schema.String),
  studios: Schema.Array(Schema.String),
  trailer: Schema.NullOr(AnimeTrailer),
  relations: Schema.Array(AnimeRelation),
  externalLinks: Schema.Array(AnimeExternalLink),
})
export type AnimeDetail = typeof AnimeDetail.Type

export const AnimeWatchOrder = Schema.Struct({
  entries: Schema.Array(AnimeItem),
})
export type AnimeWatchOrder = typeof AnimeWatchOrder.Type

export const AnimePage = Schema.Struct({
  items: Schema.Array(AnimeItem),
  page: Schema.Int.check(Schema.isGreaterThan(0)),
  perPage: Schema.Int.check(Schema.isGreaterThan(0)),
  hasNextPage: Schema.Boolean,
})
export type AnimePage = typeof AnimePage.Type

export const LatestEpisode = Schema.Struct({
  anime: AnimeItem,
  episode: Schema.Int.check(Schema.isGreaterThan(0)),
  airedAt: Schema.Int.check(Schema.isGreaterThan(0)),
  image: Schema.NullOr(Schema.String),
})
export type LatestEpisode = typeof LatestEpisode.Type

export const AnimeHeroItem = Schema.Struct({
  ...animeItemFields,
  description: Schema.NullOr(Schema.String),
  backdrop: Schema.NullOr(Schema.String),
})
export type AnimeHeroItem = typeof AnimeHeroItem.Type

export const AnimeHome = Schema.Struct({
  trending: Schema.Array(AnimeHeroItem),
  seasonal: Schema.Array(AnimeItem),
  topRated: Schema.Array(AnimeItem),
  popular: Schema.Array(AnimeItem),
  upcoming: Schema.Array(AnimeItem),
})
export type AnimeHome = typeof AnimeHome.Type

export const AnimeSort = Schema.Literals([
  "relevance",
  "popularity",
  "score",
  "trending",
  "newest",
  "title",
  "episodes",
  "favorites",
])
export type AnimeSort = typeof AnimeSort.Type

export const AnimeCatalogStatus = Schema.Literals([
  "airing",
  "complete",
  "upcoming",
])
export type AnimeCatalogStatus = typeof AnimeCatalogStatus.Type
export const AnimeRating = Schema.Literals(["g", "pg", "pg13", "r17", "r"])
export type AnimeRating = typeof AnimeRating.Type
export const AnimeDiscoveryCategory = Schema.Literals([
  "trending",
  "seasonal",
  "popular",
  "topRated",
  "upcoming",
])
export type AnimeDiscoveryCategory = typeof AnimeDiscoveryCategory.Type

export class AnimeNotFoundError extends Schema.TaggedError<AnimeNotFoundError>()(
  "AnimeNotFoundError",
  { malId: MalId, message: Schema.String }
) {}

export class AnimeUnavailableError extends Schema.TaggedError<AnimeUnavailableError>()(
  "AnimeUnavailableError",
  { message: Schema.String }
) {}
