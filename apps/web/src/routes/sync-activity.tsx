import { createFileRoute, redirect } from "@tanstack/react-router"
import { decodeSyncActivitySearch } from "../features/library/search"
import { SyncActivityPage } from "../features/library/sync-activity-page"
import { getAppSession } from "../lib/session"

export const Route = createFileRoute("/sync-activity")({
  validateSearch: decodeSyncActivitySearch,
  beforeLoad: async () => {
    if (!(await getAppSession()))
      throw redirect({ to: "/login", search: { redirect: "/sync-activity" } })
  },
  component: SyncActivityRoute,
})

function SyncActivityRoute() {
  return <SyncActivityPage {...Route.useSearch()} />
}
