import type { AnimeItem } from "@animekaiser/domain"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { cn } from "@animekaiser/ui/lib/utils"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { Check, Clock3 } from "lucide-react"
import { SectionHeading } from "../common/anime-scroll-row"
import { AnimeTitle } from "../common/anime-title"
import { scheduleAtom } from "./atoms"
import { NextEpisodeCountdown } from "./next-episode-countdown"
import { getTodayScheduleDay, scheduleRange } from "./schedule"

const airingAt = (anime: AnimeItem) =>
  anime.nextAiringEpisode ? anime.nextAiringEpisode.airingAt * 1000 : null

// Upcoming episodes first; once the day's schedule has aired, show the most
// recent ones so the strip does not go empty in the evening.
const todaysLineup = (items: ReadonlyArray<AnimeItem>) => {
  const now = Date.now()
  const timed = items.filter((anime) => airingAt(anime) !== null)
  const upcoming = timed
    .filter((anime) => (airingAt(anime) ?? 0) > now)
    .sort((left, right) => (airingAt(left) ?? 0) - (airingAt(right) ?? 0))
  const aired = timed
    .filter((anime) => (airingAt(anime) ?? 0) <= now)
    .sort((left, right) => (airingAt(right) ?? 0) - (airingAt(left) ?? 0))
  return [...upcoming, ...aired].slice(0, 16)
}

export function AiringTodayList() {
  const range = scheduleRange(getTodayScheduleDay())
  const result = useAtomValue(scheduleAtom(range.from, range.to, 1, 50))

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <SectionHeading
        title="Airing today"
        eyebrow="Schedule"
        more={{ to: "/schedule" }}
      />
      {Result.builder(result)
        .onSuccess((page) => {
          const items = todaysLineup(page.items).slice(0, 8)
          return items.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nothing else airs today.
            </p>
          ) : (
            <ol className="flex flex-col">
              {items.map((anime) => (
                <AiringTodayItem key={anime.malId} anime={anime} />
              ))}
            </ol>
          )
        })
        .orElse(() => (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_item, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ))}
    </section>
  )
}

function AiringTodayItem({ anime }: { anime: AnimeItem }) {
  const next = anime.nextAiringEpisode
  const aired = next ? next.airingAt * 1000 <= Date.now() : false

  return (
    <li>
      <Link
        to="/series/$id"
        params={{ id: anime.malId }}
        preload="intent"
        className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-muted/60"
      >
        <span
          className={cn(
            "w-14 shrink-0 text-sm font-semibold tabular-nums",
            aired ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {next
            ? new Date(next.airingAt * 1000).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })
            : null}
        </span>
        {anime.coverImage ? (
          <img
            src={anime.coverImage}
            alt=""
            className="aspect-2/3 w-10 shrink-0 rounded-md object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium group-hover:text-primary">
            <AnimeTitle title={anime.title} />
          </p>
          {next ? (
            <p
              className={cn(
                "text-xs tabular-nums",
                aired ? "text-muted-foreground" : "text-emerald-500"
              )}
            >
              Episode {next.episode} ·{" "}
              {aired ? (
                "aired"
              ) : (
                <NextEpisodeCountdown airingAt={next.airingAt} />
              )}
            </p>
          ) : null}
        </div>
        {aired ? (
          <Check className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <Clock3 className="size-4 shrink-0 text-muted-foreground" />
        )}
      </Link>
    </li>
  )
}
