import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link, useNavigate } from "@tanstack/react-router"
import type { AnimeItem, AnimePage, AnimeScheduleDay } from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { CalendarClock, Clock3 } from "lucide-react"
import { PageHero } from "../../components/page-hero"
import { AnimeSubtitle, AnimeTitle } from "./anime-title"
import { scheduleAtom } from "./atoms"
import { formatAnimeMeta } from "./format"
import { NextEpisodeCountdown } from "./next-episode-countdown"
import { getCurrentWeek, scheduleRange, sortScheduleItems } from "./schedule"
import type { ScheduleSearch } from "./search"

const dayLabel = (day: AnimeScheduleDay) =>
  day.slice(0, 1).toUpperCase() + day.slice(1, 3)

const fullDayLabel = (day: AnimeScheduleDay) =>
  day.slice(0, 1).toUpperCase() + day.slice(1)

const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date)

const weekRange = (week: ReturnType<typeof getCurrentWeek>) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  })
  return `${formatter.format(week[0].date)} – ${formatter.format(week[6].date)}`
}

function isAired(anime: AnimeItem) {
  if (!anime.nextAiringEpisode) return false
  return anime.nextAiringEpisode.airingAt * 1000 <= Date.now()
}

export function SchedulePage({
  search,
  initial,
}: {
  search: ScheduleSearch
  initial: AnimePage
}) {
  const navigate = useNavigate()
  const range = scheduleRange(search.day)
  const result = useAtomValue(scheduleAtom(range.from, range.to, 1, 50))
  if (Result.isWaiting(result)) return <SchedulePendingPage />

  const data = Result.match(result, {
    onInitial: () => initial,
    onFailure: () => initial,
    onSuccess: ({ value }) => value,
  })
  const week = getCurrentWeek()
  const sorted = sortScheduleItems(data.items)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 pb-8 md:p-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="transition hover:text-foreground">
          Home
        </Link>
        <span>/</span>
        <span className="text-foreground">Schedule</span>
      </nav>

      <PageHero
        icon={CalendarClock}
        kicker={weekRange(week)}
        title="Weekly schedule"
        description="Browse airing titles by day of the week."
      />

      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {week.map((item) => {
          const active = item.day === search.day
          return (
            <button
              key={item.day}
              type="button"
              onClick={() =>
                navigate({
                  to: "/schedule",
                  search: { ...search, day: item.day },
                })
              }
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-2 py-2 text-sm transition",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <span className="text-xs font-medium">
                {dayLabel(item.day)}
              </span>
              <span
                className={cn(
                  "text-[11px]",
                  active
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground"
                )}
              >
                {dateLabel(item.date)}
              </span>
            </button>
          )
        })}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold tracking-tight">
            {fullDayLabel(search.day)}
          </h2>
          <span className="text-sm text-muted-foreground">
            {sorted.length} titles
          </span>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No scheduled anime found for this day.
          </div>
        ) : (
          <div className="divide-y rounded-xl border bg-card/80">
            {sorted.map((anime) => (
              <Link
                key={anime.malId}
                to="/series/$id"
                params={{ id: anime.malId }}
                preload="intent"
                className="group flex items-center gap-3 p-3 transition hover:bg-accent"
              >
                <div className="w-12 shrink-0 overflow-hidden rounded-md">
                  {anime.coverImage ? (
                    <img
                      src={anime.coverImage}
                      alt=""
                      className="aspect-2/3 w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="aspect-2/3 w-full bg-muted" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h3 className="line-clamp-1 text-sm font-medium group-hover:text-primary">
                    <AnimeTitle title={anime.title} />
                  </h3>
                  <AnimeSubtitle title={anime.title}>
                    {(subtitle) => (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {subtitle}
                      </p>
                    )}
                  </AnimeSubtitle>
                  <p className="text-xs text-muted-foreground">
                    {formatAnimeMeta(
                      anime.format,
                      anime.status,
                      anime.episodes
                    )}
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Clock3 className="size-3" />
                    {anime.broadcast?.time ?? "TBA"}
                  </Badge>
                  {anime.nextAiringEpisode ? (
                    <Badge variant="secondary" className="text-xs">
                      {isAired(anime) ? (
                        `Ep ${anime.nextAiringEpisode.episode} · Aired`
                      ) : (
                        <>
                          Ep {anime.nextAiringEpisode.episode}:{" "}
                          <NextEpisodeCountdown
                            airingAt={anime.nextAiringEpisode.airingAt}
                          />
                        </>
                      )}
                    </Badge>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export function SchedulePendingPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 pb-8 md:p-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-14 w-full rounded-lg" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_item, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
