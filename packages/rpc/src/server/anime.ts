import { AiringService, AnimeService } from "@animekaiser/core"
import { AnimeRpcs, AnimeUnavailableError } from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export const AnimeHandlersLive = AnimeRpcs.toLayer(
  Effect.gen(function* () {
    const airingService = yield* AiringService
    const animeService = yield* AnimeService
    return AnimeRpcs.of({
      GetAnimeHome: () => animeService.getHome(),
      ListAnimeCatalog: (input) => animeService.getCatalog(input),
      ListAnimeDiscovery: ({ category, page, perPage }) =>
        animeService.getDiscovery(category, page, perPage),
      ListAnimeSchedule: ({ from, to, page, perPage }) =>
        from >= to
          ? Effect.fail(
              new AnimeUnavailableError({
                message: "Schedule range is invalid.",
              })
            )
          : animeService.getSchedule(from, to, page, perPage),
      ListLatestEpisodes: () => airingService.listLatestEpisodes(),
      GetRandomAnime: () => animeService.getRandom(),
      GetAnimeDetail: ({ malId }) => animeService.getDetail(malId),
      GetAnimeWatchOrder: ({ malId }) => animeService.getWatchOrder(malId),
      ListAnimeRecommendations: ({ malId, page, perPage }) =>
        animeService.getRecommendations(malId, page, perPage),
    })
  })
).pipe(Layer.provide(AnimeService.layer), Layer.provide(AiringService.layer))
