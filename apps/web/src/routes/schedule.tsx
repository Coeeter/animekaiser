import { createFileRoute } from "@tanstack/react-router"
import { decodeScheduleSearch } from "../features/anime/common/search"
import { SchedulePage } from "../features/anime/schedule/schedule-page"

export const Route = createFileRoute("/schedule")({
  staticData: { title: "Schedule" },
  validateSearch: decodeScheduleSearch,
  component: ScheduleRoute,
})

function ScheduleRoute() {
  return <SchedulePage search={Route.useSearch()} />
}
