import { createFileRoute } from "@tanstack/react-router"
import { decodeSyncActivitySearch } from "../features/library/search"
import { SyncActivityPage } from "../features/library/sync-activity-page"

export const Route = createFileRoute("/sync-activity")({
  staticData: { title: "Sync Activity" },
  validateSearch: decodeSyncActivitySearch,
  component: SyncActivityRoute,
})

function SyncActivityRoute() {
  return <SyncActivityPage {...Route.useSearch()} />
}
