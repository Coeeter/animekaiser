import type { AnimeItem } from "@animekaiser/domain"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { Clock3 } from "lucide-react"
import { MediaRow } from "../common/anime-scroll-row"
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

export function AiringTodayRow() {
  const range = scheduleRange(getTodayScheduleDay())
  const result = useAtomValue(scheduleAtom(range.from, range.to, 1, 50))

  return Result.builder(result)
    .onSuccess((page) => {
      const items = todaysLineup(page.items)
      return items.length === 0 ? null : (
        <MediaRow
          title="Airing today"
          eyebrow="Schedule"
          more={{ to: "/schedule" }}
        >
          {items.map((anime) => (
            <AiringTodayCard key={anime.malId} anime={anime} />
          ))}
        </MediaRow>
      )
    })
    .orElse(() => null)
}

function AiringTodayCard({ anime }: { anime: AnimeItem }) {
  const next = anime.nextAiringEpisode
  const aired = next ? next.airingAt * 1000 <= Date.now() : false

  return (
    <Link
      to="/series/$id"
      params={{ id: anime.malId }}
      preload="intent"
      className="group flex w-32 shrink-0 flex-col gap-2 sm:w-36"
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-xl bg-muted ring-1 ring-white/10 transition group-hover:ring-primary/50">
        {anime.coverImage ? (
          <img
            src={anime.coverImage}
            alt=""
            className="size-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-8">
          {next ? (
            <p className="flex items-center gap-1 text-[11px] font-semibold text-white tabular-nums">
              <Clock3 className="size-3" />
              {new Date(next.airingAt * 1000).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          ) : null}
          {next ? (
            <p
              className={
                aired
                  ? "text-[11px] text-white/60"
                  : "text-[11px] text-emerald-300 tabular-nums"
              }
            >
              Ep {next.episode} ·{" "}
              {aired ? (
                "aired"
              ) : (
                <NextEpisodeCountdown airingAt={next.airingAt} />
              )}
            </p>
          ) : null}
        </div>
      </div>
      <h3 className="line-clamp-2 text-xs leading-snug font-medium group-hover:text-primary">
        <AnimeTitle title={anime.title} />
      </h3>
    </Link>
  )
}
