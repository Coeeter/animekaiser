import { createFileRoute, redirect } from "@tanstack/react-router"
import { MyListPage } from "../features/library/my-list-page"
import { decodeMyListSearch } from "../features/library/search"
import { getAppSession } from "../lib/session"

export const Route = createFileRoute("/my-list")({
  validateSearch: decodeMyListSearch,
  beforeLoad: async () => {
    if (!(await getAppSession()))
      throw redirect({ to: "/login", search: { redirect: "/my-list" } })
  },
  component: MyListRoute,
})

function MyListRoute() {
  return <MyListPage search={Route.useSearch()} />
}
