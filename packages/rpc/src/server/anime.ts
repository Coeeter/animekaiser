import { AnimeService } from "@workspace/core"
import { AnimeRpcs, AnimeUnavailableError } from "@workspace/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export const AnimeHandlersLive = AnimeRpcs.toLayer(
  AnimeRpcs.of({
    GetAnimeHome: () => AnimeService.getHome(),
    ListAnimeCatalog: (input) => AnimeService.getCatalog(input),
    ListAnimeDiscovery: ({ category, page, perPage }) =>
      AnimeService.getDiscovery(category, page, perPage),
    ListAnimeSchedule: ({ from, to, page, perPage }) =>
      from >= to
        ? Effect.fail(
            new AnimeUnavailableError({ message: "Schedule range is invalid." })
          )
        : AnimeService.getSchedule(from, to, page, perPage),
    GetRandomAnime: () => AnimeService.getRandom(),
    GetAnimeDetail: ({ malId }) => AnimeService.getDetail(malId),
    ListAnimeRecommendations: ({ malId, page, perPage }) =>
      AnimeService.getRecommendations(malId, page, perPage),
  })
).pipe(Layer.provide(AnimeService.Default))
