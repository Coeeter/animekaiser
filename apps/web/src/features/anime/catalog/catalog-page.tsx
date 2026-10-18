import { useAtomRefresh, useAtomValue } from "@effect/atom-react"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { DataError } from "../../../components/data-error"
import type { CatalogSearch } from "../common/search"
import { catalogAtom } from "./atoms"
import { SeriesCatalogLayout } from "./series-catalog-layout"
import { SeriesCatalogPending } from "./series-catalog-pending"
import { SeriesCatalogResults } from "./series-catalog-results"

export function CatalogPage({ search }: { search: CatalogSearch }) {
  const atom = catalogAtom(search)
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)

  return AsyncResult.builder(result)
    .onInitialOrWaiting(() => <CatalogPendingPage search={search} />)
    .onFailure(() => (
      <SeriesCatalogLayout search={search}>
        <DataError onRetry={refresh} />
      </SeriesCatalogLayout>
    ))
    .onSuccess((page) => (
      <SeriesCatalogLayout search={search}>
        <SeriesCatalogResults page={page} search={search} />
      </SeriesCatalogLayout>
    ))
    .render()
}

export function CatalogPendingPage({ search }: { search: CatalogSearch }) {
  return (
    <SeriesCatalogLayout search={search}>
      <SeriesCatalogPending />
    </SeriesCatalogLayout>
  )
}
