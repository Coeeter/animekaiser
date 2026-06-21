import { createFileRoute } from "@tanstack/react-router"
import { loadAnimeCatalog } from "../features/anime/anime.functions"
import { CatalogPage } from "../features/anime/catalog-page"
import { catalogInput, decodeCatalogSearch } from "../features/anime/search"

export const Route = createFileRoute("/series/")({
  validateSearch: decodeCatalogSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadAnimeCatalog(catalogInput(deps)),
  component: CatalogRoute,
})

function CatalogRoute() {
  return (
    <CatalogPage search={Route.useSearch()} initial={Route.useLoaderData()} />
  )
}
