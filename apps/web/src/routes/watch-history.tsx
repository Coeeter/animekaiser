import { createFileRoute } from "@tanstack/react-router"
import { WatchHistoryPage } from "../features/library/watch-history-page"

export const Route = createFileRoute("/watch-history")({
  staticData: { title: "Watch History" },
  component: WatchHistoryPage,
})
