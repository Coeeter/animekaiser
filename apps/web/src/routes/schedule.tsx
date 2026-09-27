import { createFileRoute } from "@tanstack/react-router"
import { CalendarDays } from "lucide-react"
import { PageHero } from "../components/page-hero"
import { ScheduleSection } from "../features/anime/schedule/schedule-section"

export const Route = createFileRoute("/schedule")({
  staticData: { title: "Schedule" },
  component: SchedulePage,
})

function SchedulePage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <PageHero
        icon={CalendarDays}
        kicker="Airing this week"
        title="Schedule"
        description="Episode times in your timezone, with countdowns for what is still to come."
      />
      <ScheduleSection heading={false} />
    </div>
  )
}
