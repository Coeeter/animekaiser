import { Result, useAtomValue } from "@effect-atom/atom-react"
import type { AnimePage } from "@workspace/domain"
import { catalogAtom } from "./atoms"
import { DEFAULT_CATALOG_PER_PAGE } from "./search"
import type { CatalogSearch } from "./search"
import { SeriesCatalogLayout } from "./series-catalog-layout"
import { SeriesCatalogPending } from "./series-catalog-pending"
import { SeriesCatalogResults } from "./series-catalog-results"

export function CatalogPage({
  search,
  initial,
}: {
  search: CatalogSearch
  initial: AnimePage
}) {
  const result = useAtomValue(
    catalogAtom(
      search.q,
      search.page,
      DEFAULT_CATALOG_PER_PAGE,
      search.sort,
      search.status,
      search.format,
      search.genre,
      search.season,
      search.seasonYear,
      search.rating,
      search.minScore,
      search.maxScore
    )
  )
  if (Result.isWaiting(result)) return <CatalogPendingPage search={search} />

  const page = Result.match(result, {
    onInitial: () => initial,
    onFailure: () => initial,
    onSuccess: ({ value }) => value,
  })

  return (
    <SeriesCatalogLayout search={search}>
      <SeriesCatalogResults page={page} search={search} />
    </SeriesCatalogLayout>
  )
}

export function CatalogPendingPage({ search }: { search: CatalogSearch }) {
  return (
    <SeriesCatalogLayout search={search}>
      <SeriesCatalogPending />
    </SeriesCatalogLayout>
  )
}
