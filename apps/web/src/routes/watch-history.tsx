import { createFileRoute, redirect } from "@tanstack/react-router"
import { WatchHistoryPage } from "../features/library/watch-history-page"
import { getAppSession } from "../lib/session"

export const Route = createFileRoute("/watch-history")({
  staticData: { title: "Watch History" },
  beforeLoad: async () => {
    if (!(await getAppSession())) {
      throw redirect({ to: "/login", search: { redirect: "/watch-history" } })
    }
  },
  component: WatchHistoryPage,
})
