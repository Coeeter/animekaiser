import type { AnimeItem, AnimeScheduleDay } from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { cn } from "@animekaiser/ui/lib/utils"
import { Result, useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { Clock3 } from "lucide-react"
import { useState } from "react"
import { DataError } from "../../../components/data-error"
import { AnimeSubtitle, AnimeTitle } from "../common/anime-title"
import { formatAnimeMeta } from "../common/format"
import { scheduleAtom } from "./atoms"
import { NextEpisodeCountdown } from "./next-episode-countdown"
import {
  getCurrentWeek,
  getTodayScheduleDay,
  scheduleRange,
  sortScheduleItems,
} from "./schedule"

const dayLabel = (day: AnimeScheduleDay) =>
  day.slice(0, 1).toUpperCase() + day.slice(1, 3)

const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date)

const isAired = (anime: AnimeItem) =>
  anime.nextAiringEpisode
    ? anime.nextAiringEpisode.airingAt * 1000 <= Date.now()
    : false

export function ScheduleSection() {
  const week = getCurrentWeek()
  const [day, setDay] = useState<AnimeScheduleDay>(() => getTodayScheduleDay())
  const today = getTodayScheduleDay()

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
            Airing this week
          </p>
          <h2 className="font-heading text-lg font-bold tracking-tight md:text-xl">
            Schedule
          </h2>
        </div>
      </div>

      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border bg-card p-1">
        {week.map((item) => {
          const active = item.day === day

          return (
            <button
              key={item.day}
              type="button"
              aria-current={active ? "true" : undefined}
              onClick={() => setDay(item.day)}
              className={cn(
                "flex min-w-14 flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <span className="text-xs font-medium">
                {dayLabel(item.day)}
                {item.day === today ? " ·" : ""}
              </span>
              <span
                className={cn(
                  "text-[11px] whitespace-nowrap",
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

      <ScheduleResults day={day} />
    </section>
  )
}

function ScheduleResults({ day }: { day: AnimeScheduleDay }) {
  const range = scheduleRange(day)
  const atom = scheduleAtom(range.from, range.to, 1, 50)
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)

  return Result.builder(result)
    .onInitialOrWaiting(() => <ScheduleResultsPending />)
    .onFailure(() => <DataError onRetry={refresh} />)
    .onSuccess((data) => <ScheduleList items={sortScheduleItems(data.items)} />)
    .render()
}

function ScheduleList({ items }: { items: ReadonlyArray<AnimeItem> }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Nothing airing on this day.
      </div>
    )
  }

  return (
    <div className="divide-y rounded-2xl border bg-card/80">
      {items.map((anime) => (
        <Link
          key={anime.malId}
          to="/series/$id"
          params={{ id: anime.malId }}
          preload="intent"
          className="group flex items-center gap-3 p-3 transition hover:bg-accent"
        >
          <div className="w-12 shrink-0 overflow-hidden rounded-lg">
            {anime.coverImage ? (
              <img
                src={anime.coverImage}
                alt=""
                className="aspect-2/3 w-full object-cover"
                loading="lazy"
                decoding="async"
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
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }, (_item, index) => (
        <Skeleton key={index} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  )
}
