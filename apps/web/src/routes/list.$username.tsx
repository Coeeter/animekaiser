import { createFileRoute } from "@tanstack/react-router"
import { PublicListPage } from "../features/library/public-list-page"
import { decodeMyListSearch } from "../features/library/search"

export const Route = createFileRoute("/list/$username")({
  staticData: { title: "Shared list" },
  validateSearch: decodeMyListSearch,
  component: PublicListRoute,
})

function PublicListRoute() {
  return (
    <PublicListPage
      username={Route.useParams().username}
      search={Route.useSearch()}
    />
  )
}
