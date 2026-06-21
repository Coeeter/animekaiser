import { Rpc, RpcGroup } from "@effect/rpc"
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
  MalId,
} from "../anime"

const animeFailure = Schema.Union(AnimeNotFoundError, AnimeUnavailableError)

export const AnimeRpcs = RpcGroup.make(
  Rpc.make("GetAnimeHome", { success: AnimeHome, error: AnimeUnavailableError }),
  Rpc.make("ListAnimeCatalog", {
    payload: {
      query: Schema.optional(Schema.String),
      page: Schema.Int.pipe(Schema.positive()),
      perPage: Schema.Int.pipe(Schema.between(1, 50)),
      sort: AnimeSort,
      status: Schema.optional(AnimeCatalogStatus),
      format: Schema.optional(AnimeFormat),
      genres: Schema.optional(Schema.Array(Schema.String)),
      season: Schema.optional(AnimeSeason),
      seasonYear: Schema.optional(Schema.Int.pipe(Schema.between(1900, 2200))),
      rating: Schema.optional(AnimeRating),
      minScore: Schema.optional(Schema.Number.pipe(Schema.between(0, 10))),
      maxScore: Schema.optional(Schema.Number.pipe(Schema.between(0, 10))),
    },
    success: AnimePage,
    error: AnimeUnavailableError,
  }),
  Rpc.make("ListAnimeDiscovery", {
    payload: {
      category: AnimeDiscoveryCategory,
      page: Schema.Int.pipe(Schema.positive()),
      perPage: Schema.Int.pipe(Schema.between(1, 50)),
    },
    success: AnimePage,
    error: AnimeUnavailableError,
  }),
  Rpc.make("ListAnimeSchedule", {
    payload: {
      from: Schema.Int.pipe(Schema.positive()),
      to: Schema.Int.pipe(Schema.positive()),
      page: Schema.Int.pipe(Schema.positive()),
      perPage: Schema.Int.pipe(Schema.between(1, 50)),
    },
    success: AnimePage,
    error: AnimeUnavailableError,
  }),
  Rpc.make("GetRandomAnime", {
    success: MalId,
    error: AnimeUnavailableError,
  }),
  Rpc.make("GetAnimeDetail", {
    payload: { malId: MalId },
    success: AnimeDetail,
    error: animeFailure,
  }),
  Rpc.make("ListAnimeRecommendations", {
    payload: {
      malId: MalId,
      page: Schema.Int.pipe(Schema.positive()),
      perPage: Schema.Int.pipe(Schema.between(1, 50)),
    },
    success: AnimePage,
    error: animeFailure,
  })
)

