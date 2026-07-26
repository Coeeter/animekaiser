import { createFileRoute } from "@tanstack/react-router"
import { CatalogPage } from "../features/anime/catalog/catalog-page"
import { decodeCatalogSearch } from "../features/anime/common/search"

export const Route = createFileRoute("/series/")({
  staticData: { title: "Browse" },
  validateSearch: decodeCatalogSearch,
  component: CatalogRoute,
})

function CatalogRoute() {
  return <CatalogPage search={Route.useSearch()} />
}
