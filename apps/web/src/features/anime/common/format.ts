import type { AnimeFormat, AnimeReleaseStatus } from "@workspace/domain"

export const formatAnimeFormat = (format: AnimeFormat | null) => {
  if (format === "TV_SHORT") return "TV Short"
  return format ?? "Anime"
}

export const formatAnimeStatus = (status: AnimeReleaseStatus | null) => {
  if (status === "NOT_YET_RELEASED") return "Upcoming"
  if (status === "RELEASING") return "Airing"
  if (status === "FINISHED") return "Finished"
  if (status === "CANCELLED") return "Cancelled"
  if (status === "HIATUS") return "Hiatus"
  return null
}

export const formatAnimeMeta = (
  format: AnimeFormat | null,
  status: AnimeReleaseStatus | null,
  episodes: number | null
) =>
  [
    formatAnimeFormat(format),
    formatAnimeStatus(status),
    episodes ? `${episodes} eps` : null,
  ]
    .filter(Boolean)
    .join(" · ")
