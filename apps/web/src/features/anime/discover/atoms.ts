import type { AnimeDiscoveryCategory } from "@animekaiser/domain"
import { KaiserRpcClient } from "../../../services/api-clients"

export const discoveryAtom = (
  category: AnimeDiscoveryCategory,
  page: number,
  perPage: number
) => KaiserRpcClient.query("ListAnimeDiscovery", { category, page, perPage })
