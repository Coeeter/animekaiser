import { KaiserRpcClient } from "../../../services/api-clients"

export const latestEpisodesAtom = KaiserRpcClient.query(
  "ListLatestEpisodes",
  undefined,
  { timeToLive: "5 minutes" }
)
