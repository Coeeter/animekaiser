import { createFileRoute } from "@tanstack/react-router"
import { loadAnimeDiscovery } from "../features/anime/anime.functions"
import {
  DiscoverPage,
  DiscoverPendingPage,
} from "../features/anime/discover-page"
import { decodeDiscoverSearch } from "../features/anime/search"

export const Route = createFileRoute("/discover")({
  staticData: { title: "Discover" },
  validateSearch: decodeDiscoverSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadAnimeDiscovery(deps.tab, deps.page),
  pendingComponent: DiscoverPendingPage,
  component: DiscoverRoute,
})

function DiscoverRoute() {
  return (
    <DiscoverPage search={Route.useSearch()} initial={Route.useLoaderData()} />
  )
}
