import { createFileRoute } from "@tanstack/react-router"
import { loadAnimeDiscovery } from "../features/anime/anime.functions"
import { DiscoverPage } from "../features/anime/discover-page"
import { decodeDiscoverSearch } from "../features/anime/search"

export const Route = createFileRoute("/discover")({
  validateSearch: decodeDiscoverSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadAnimeDiscovery(deps.tab, deps.page),
  component: DiscoverRoute,
})

function DiscoverRoute() {
  return (
    <DiscoverPage search={Route.useSearch()} initial={Route.useLoaderData()} />
  )
}
