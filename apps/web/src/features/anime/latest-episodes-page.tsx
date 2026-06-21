import { Clapperboard } from "lucide-react"
import { EmptyFeaturePage } from "../../components/empty-feature-page"

export function LatestEpisodesPage() {
  return (
    <EmptyFeaturePage
      icon={Clapperboard}
      kicker="Coming soon"
      title="Latest episodes"
      description="Recently aired episodes will show up here once this feature is ready. In the meantime, browse the catalog to find something to watch."
    />
  )
}
