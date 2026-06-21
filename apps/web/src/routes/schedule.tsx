import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link, createFileRoute } from "@tanstack/react-router"
import type { AnimeScheduleDay } from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { CalendarClock, Clock3 } from "lucide-react"
import { loadAnimeSchedule } from "../api"
import { PageHero } from "../components/page-hero"
import { AnimeTitle } from "../features/anime/anime-title"
import { scheduleAtom } from "../features/anime/atoms"
import { formatAnimeMeta } from "../features/anime/format"
import { NextEpisodeCountdown } from "../features/anime/next-episode-countdown"
import {
  getCurrentWeek,
  getTodayScheduleDay,
  scheduleDays,
  scheduleRange,
  sortScheduleItems,
} from "../features/anime/schedule"

export const Route = createFileRoute("/schedule")({
  validateSearch: (search): { day: AnimeScheduleDay } => ({
    day:
      typeof search.day === "string" &&
      scheduleDays.includes(search.day as AnimeScheduleDay)
        ? (search.day as AnimeScheduleDay)
        : getTodayScheduleDay(),
  }),
  loaderDeps: ({ search }) => ({ ...search, ...scheduleRange(search.day) }),
  loader: ({ deps }) => loadAnimeSchedule(deps.from, deps.to),
  component: SchedulePage,
})

function SchedulePage() {
  const search = Route.useSearch()
  const initial = Route.useLoaderData()
  const range = scheduleRange(search.day)
  const result = useAtomValue(
    scheduleAtom({ ...range, page: 1, perPage: 50, initialValue: initial })
  )
  const data = Result.match(result, {
    onInitial: () => initial,
    onFailure: () => initial,
    onSuccess: ({ value }) => value,
  })
  const items = sortScheduleItems(data.items)
  const week = getCurrentWeek()
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 pb-10 md:p-6">
      <nav className="flex gap-2 text-sm text-muted-foreground">
        <Link to="/">Home</Link>
        <span>/</span>
        <span className="text-foreground">Schedule</span>
      </nav>
      <PageHero
        icon={CalendarClock}
        kicker="This week"
        title="Weekly schedule"
        description="Browse airing titles by day of the week."
      />
      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {week.map(({ day, date }) => (
          <Link
            key={day}
            to="/schedule"
            search={{ day }}
            className={`flex min-w-20 flex-1 flex-col items-center rounded-md px-2 py-2 text-sm ${day === search.day ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
          >
            <span className="font-medium capitalize">{day.slice(0, 3)}</span>
            <span className="text-[11px]">
              {date.toLocaleDateString("en", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </Link>
        ))}
      </div>
      <section className="flex flex-col gap-3">
        <div className="flex justify-between">
          <h2 className="font-heading text-xl font-bold capitalize">
            {search.day}
          </h2>
          <span className="text-sm text-muted-foreground">
            {items.length} titles
          </span>
        </div>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No scheduled anime found for this day.
          </div>
        ) : (
          <div className="divide-y rounded-xl border bg-card/80">
            {items.map((anime) => (
              <Link
                key={anime.malId}
                to="/series/$id"
                params={{ id: anime.malId }}
                className="group flex items-center gap-3 p-3 hover:bg-accent"
              >
                {anime.coverImage ? (
                  <img
                    src={anime.coverImage}
                    alt=""
                    className="aspect-2/3 w-12 rounded-md object-cover"
                  />
                ) : (
                  <div className="aspect-2/3 w-12 rounded-md bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium group-hover:text-primary">
                    <AnimeTitle title={anime.title} />
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {formatAnimeMeta(
                      anime.format,
                      anime.status,
                      anime.episodes
                    )}
                  </p>
                </div>
                <div className="hidden gap-2 sm:flex">
                  <Badge variant="outline">
                    <Clock3 className="size-3" />
                    {anime.broadcast?.time ?? "TBA"}
                  </Badge>
                  {anime.nextAiringEpisode ? (
                    <Badge variant="secondary">
                      Ep {anime.nextAiringEpisode.episode} ·{" "}
                      <NextEpisodeCountdown
                        airingAt={anime.nextAiringEpisode.airingAt}
                      />
                    </Badge>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
