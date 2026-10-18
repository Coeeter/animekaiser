import { Rpc, RpcGroup } from "effect/rpc"
import * as Schema from "effect/Schema"
import {
  AnimeCatalogStatus,
  AnimeDetail,
  AnimeDiscoveryCategory,
  AnimeFormat,
  AnimeHome,
  AnimeNotFoundError,
  AnimePage,
  AnimeRating,
  AnimeSeason,
  AnimeSort,
  AnimeUnavailableError,
  AnimeWatchOrder,
  LatestEpisode,
  MalId,
} from "./models"

const animeFailure = Schema.Union([AnimeNotFoundError, AnimeUnavailableError])

export class GetAnimeHome extends Rpc.make("GetAnimeHome", {
  success: AnimeHome,
  error: AnimeUnavailableError,
}) {}

export class ListAnimeCatalog extends Rpc.make("ListAnimeCatalog", {
  payload: {
    query: Schema.optional(Schema.String),
    page: Schema.Int.check(Schema.isGreaterThan(0)),
    perPage: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 50 })),
    sort: AnimeSort,
    status: Schema.optional(AnimeCatalogStatus),
    format: Schema.optional(AnimeFormat),
    genres: Schema.optional(Schema.Array(Schema.String)),
    season: Schema.optional(AnimeSeason),
    seasonYear: Schema.optional(
      Schema.Int.check(Schema.isBetween({ minimum: 1900, maximum: 2200 }))
    ),
    rating: Schema.optional(AnimeRating),
    minScore: Schema.optional(
      Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 10 }))
    ),
    maxScore: Schema.optional(
      Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 10 }))
    ),
    studio: Schema.optional(Schema.String.check(Schema.isMaxLength(120))),
  },
  success: AnimePage,
  error: AnimeUnavailableError,
}) {}

export class ListAnimeDiscovery extends Rpc.make("ListAnimeDiscovery", {
  payload: {
    category: AnimeDiscoveryCategory,
    page: Schema.Int.check(Schema.isGreaterThan(0)),
    perPage: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 50 })),
  },
  success: AnimePage,
  error: AnimeUnavailableError,
}) {}

export class ListAnimeSchedule extends Rpc.make("ListAnimeSchedule", {
  payload: {
    from: Schema.Int.check(Schema.isGreaterThan(0)),
    to: Schema.Int.check(Schema.isGreaterThan(0)),
    page: Schema.Int.check(Schema.isGreaterThan(0)),
    perPage: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 50 })),
  },
  success: AnimePage,
  error: AnimeUnavailableError,
}) {}

export class ListLatestEpisodes extends Rpc.make("ListLatestEpisodes", {
  success: Schema.Array(LatestEpisode),
  error: AnimeUnavailableError,
}) {}

export class GetRandomAnime extends Rpc.make("GetRandomAnime", {
  success: MalId,
  error: AnimeUnavailableError,
}) {}

export class GetAnimeDetail extends Rpc.make("GetAnimeDetail", {
  payload: { malId: MalId },
  success: AnimeDetail,
  error: animeFailure,
}) {}

export class GetAnimeWatchOrder extends Rpc.make("GetAnimeWatchOrder", {
  payload: { malId: MalId },
  success: AnimeWatchOrder,
  error: animeFailure,
}) {}

export class ListAnimeRecommendations extends Rpc.make(
  "ListAnimeRecommendations",
  {
    payload: {
      malId: MalId,
      page: Schema.Int.check(Schema.isGreaterThan(0)),
      perPage: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 50 })),
    },
    success: AnimePage,
    error: animeFailure,
  }
) {}

export class AnimeRpcs extends RpcGroup.make(
  GetAnimeHome,
  ListAnimeCatalog,
  ListAnimeDiscovery,
  ListAnimeSchedule,
  ListLatestEpisodes,
  GetRandomAnime,
  GetAnimeDetail,
  GetAnimeWatchOrder,
  ListAnimeRecommendations
) {}
