import { createFileRoute, redirect } from "@tanstack/react-router"
import { History } from "lucide-react"
import { getAppSession } from "../auth.functions"
import { EmptyFeaturePage } from "../components/empty-feature-page"

export const Route = createFileRoute("/watch-history")({
  beforeLoad: async () => {
    if (!(await getAppSession())) {
      throw redirect({ to: "/login", search: { redirect: "/watch-history" } })
    }
  },
  component: WatchHistoryPage,
})

function WatchHistoryPage() {
  return (
    <EmptyFeaturePage
      icon={History}
      kicker="Coming soon"
      title="Watch history"
      description="Your viewing history will appear here so you can easily pick up where you left off."
    />
  )
}
