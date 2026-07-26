import { KaiserRpcClient } from "../../../services/api-clients"

export const detailAtom = (malId: number) =>
  KaiserRpcClient.query("GetAnimeDetail", { malId })

export const recommendationsAtom = (malId: number) =>
  KaiserRpcClient.query("ListAnimeRecommendations", {
    malId,
    page: 1,
    perPage: 12,
  })
