import { History } from "lucide-react"
import { EmptyFeaturePage } from "../../components/empty-feature-page"

export function WatchHistoryPage() {
  return (
    <EmptyFeaturePage
      icon={History}
      kicker="Coming soon"
      title="Watch history"
      description="Your viewing history will appear here so you can easily pick up where you left off."
    />
  )
}
