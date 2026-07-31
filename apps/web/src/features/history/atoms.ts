import {
  KaiserRpcClient,
  refreshOnAuthChange,
} from "../../services/api-clients"

export const watchHistoryReactivityKeys = {
  all: "watch-history",
}

export const continueWatchingAtom = (limit: number) =>
  refreshOnAuthChange(
    KaiserRpcClient.query(
      "ListContinueWatching",
      { limit },
      { reactivityKeys: [watchHistoryReactivityKeys.all] }
    )
  )

export const watchHistoryPageAtom = (
  page: number,
  perPage: number,
  query?: string
) =>
  refreshOnAuthChange(
    KaiserRpcClient.query(
      "ListWatchHistory",
      { page, perPage, query },
      { reactivityKeys: [watchHistoryReactivityKeys.all] }
    )
  )

export const episodeWatchProgressAtom = (malId: number, episode: number) =>
  refreshOnAuthChange(
    KaiserRpcClient.query("GetEpisodeWatchProgress", { malId, episode })
  )

export const recordWatchProgressAtom = KaiserRpcClient.mutation(
  "RecordWatchProgress"
)

export const clearWatchHistoryEntryAtom = KaiserRpcClient.mutation(
  "ClearWatchHistoryEntry"
)

export const clearWatchHistoryAtom =
  KaiserRpcClient.mutation("ClearWatchHistory")
