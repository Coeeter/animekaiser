import type { AnimeItem, AnimeScheduleDay } from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { cn } from "@animekaiser/ui/lib/utils"
import { Result, useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { CalendarClock, Clock3 } from "lucide-react"
import type { ReactNode } from "react"
import { DataError } from "../../../components/data-error"
import { PageHero } from "../../../components/page-hero"
import { AnimeSubtitle, AnimeTitle } from "../common/anime-title"
import { formatAnimeMeta } from "../common/format"
import type { ScheduleSearch } from "../common/search"
import { scheduleAtom } from "./atoms"
import { NextEpisodeCountdown } from "./next-episode-countdown"
import { getCurrentWeek, scheduleRange, sortScheduleItems } from "./schedule"

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

export function SchedulePage({ search }: { search: ScheduleSearch }) {
  return (
    <ScheduleLayout search={search}>
      <ScheduleResults search={search} />
    </ScheduleLayout>
  )
}

function ScheduleLayout({
  children,
  search,
}: {
  children: ReactNode
  search: ScheduleSearch
}) {
  const week = getCurrentWeek()

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
            <Link
              key={item.day}
              to="/schedule"
              search={{ ...search, day: item.day }}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-2 py-2 text-sm transition",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <span className="text-xs font-medium">{dayLabel(item.day)}</span>
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
            </Link>
          )
        })}
      </div>

      <section className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="font-heading text-xl font-bold tracking-tight">
          {fullDayLabel(search.day)}
        </h2>
        {children}
      </section>
    </div>
  )
}

function ScheduleResults({ search }: { search: ScheduleSearch }) {
  const range = scheduleRange(search.day)
  const atom = scheduleAtom(range.from, range.to, 1, 50)
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)

  return Result.builder(result)
    .onInitialOrWaiting(() => <ScheduleResultsPending />)
    .onFailure(() => (
      <div className="col-span-full">
        <DataError onRetry={refresh} />
      </div>
    ))
    .onSuccess((data) => {
      const sorted = sortScheduleItems(data.items)

      return (
        <>
          <span className="text-sm text-muted-foreground">
            {sorted.length} titles
          </span>
          <div className="col-span-full">
            <ScheduleList items={sorted} />
          </div>
        </>
      )
    })
    .render()
}

function ScheduleList({ items }: { items: ReadonlyArray<AnimeItem> }) {
  if (items.length === 0)
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No scheduled anime found for this day.
      </div>
    )

  return (
    <div className="divide-y rounded-xl border bg-card/80">
      {items.map((anime) => (
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
              {formatAnimeMeta(anime.format, anime.status, anime.episodes)}
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
  )
}

function ScheduleResultsPending() {
  return (
    <>
      <Skeleton className="h-4 w-16" />
      <div className="col-span-full flex flex-col gap-2">
        {Array.from({ length: 6 }, (_item, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </>
  )
}
