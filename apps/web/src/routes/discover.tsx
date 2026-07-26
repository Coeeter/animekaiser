import { createFileRoute } from "@tanstack/react-router"
import { decodeDiscoverSearch } from "../features/anime/common/search"
import { DiscoverPage } from "../features/anime/discover/discover-page"

export const Route = createFileRoute("/discover")({
  staticData: { title: "Discover" },
  validateSearch: decodeDiscoverSearch,
  component: DiscoverRoute,
})

function DiscoverRoute() {
  return <DiscoverPage search={Route.useSearch()} />
}
