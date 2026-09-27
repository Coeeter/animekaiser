import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { SearchPage } from "../features/anime/search/search-page"

const SearchParams = Schema.Struct({ q: Schema.optional(Schema.String) })

export const Route = createFileRoute("/search")({
  staticData: { title: "Search" },
  validateSearch: Schema.decodeUnknownSync(SearchParams),
  component: SearchRoute,
})

function SearchRoute() {
  const { q } = Route.useSearch()
  return <SearchPage query={q ?? ""} />
}
