import { createFileRoute } from "@tanstack/react-router"
import { decodeWatchHistorySearch } from "../features/history/search"
import { WatchHistoryPage } from "../features/history/watch-history-page"

export const Route = createFileRoute("/watch-history")({
  staticData: { title: "Watch History" },
  validateSearch: decodeWatchHistorySearch,
  component: WatchHistoryRoute,
})

function WatchHistoryRoute() {
  return <WatchHistoryPage search={Route.useSearch()} />
}
