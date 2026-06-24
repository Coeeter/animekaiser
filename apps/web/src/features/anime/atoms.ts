import type {
  AnimeCatalogStatus,
  AnimeDiscoveryCategory,
  AnimeFormat,
  AnimeRating,
  AnimeSeason,
  AnimeSort,
} from "@workspace/domain"
import { KaiserAtomRpc } from "../../lib/rpc-client"

const genresFromSearch = (genre: string | undefined) => {
  const genres = genre
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  return genres?.length ? genres : undefined
}

export const homeAtom = KaiserAtomRpc.query("GetAnimeHome", void 0)

export const catalogAtom = (
  query: string | undefined,
  page: number,
  perPage: number,
  sort: AnimeSort,
  status?: AnimeCatalogStatus,
  format?: AnimeFormat,
  genre?: string,
  season?: AnimeSeason,
  seasonYear?: number,
  rating?: AnimeRating,
  minScore?: number,
  maxScore?: number
) =>
  KaiserAtomRpc.query(
    "ListAnimeCatalog",
    {
      query: query?.trim() || undefined,
      page,
      perPage,
      sort,
      status,
      format,
      genres: genresFromSearch(genre),
      season,
      seasonYear,
      rating,
      minScore,
      maxScore,
    },
    { timeToLive: "1 minute" }
  )

export const discoveryAtom = (
  category: AnimeDiscoveryCategory,
  page: number,
  perPage: number
) => KaiserAtomRpc.query("ListAnimeDiscovery", { category, page, perPage })

export const scheduleAtom = (
  from: number,
  to: number,
  page: number,
  perPage: number
) => KaiserAtomRpc.query("ListAnimeSchedule", { from, to, page, perPage })

export const detailAtom = (malId: number) =>
  KaiserAtomRpc.query("GetAnimeDetail", { malId })

export const recommendationsAtom = (malId: number) =>
  KaiserAtomRpc.query("ListAnimeRecommendations", {
    malId,
    page: 1,
    perPage: 12,
  })
