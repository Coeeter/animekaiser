import { createFileRoute } from "@tanstack/react-router"
import { loadAnimeSchedule } from "../features/anime/anime.functions"
import { scheduleRange } from "../features/anime/schedule"
import {
  SchedulePage,
  SchedulePendingPage,
} from "../features/anime/schedule-page"
import { decodeScheduleSearch } from "../features/anime/search"

export const Route = createFileRoute("/schedule")({
  validateSearch: decodeScheduleSearch,
  loaderDeps: ({ search }) => ({ ...search, ...scheduleRange(search.day) }),
  loader: ({ deps }) => loadAnimeSchedule(deps.from, deps.to),
  pendingComponent: SchedulePendingPage,
  component: ScheduleRoute,
})

function ScheduleRoute() {
  return (
    <SchedulePage search={Route.useSearch()} initial={Route.useLoaderData()} />
  )
}
