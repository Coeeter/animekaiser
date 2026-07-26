import { createFileRoute } from "@tanstack/react-router"
import { MyListPage } from "../features/library/my-list-page"
import { decodeMyListSearch } from "../features/library/search"

export const Route = createFileRoute("/my-list")({
  staticData: { title: "My List" },
  validateSearch: decodeMyListSearch,
  component: MyListRoute,
})

function MyListRoute() {
  return <MyListPage search={Route.useSearch()} />
}
