import type { LibraryNewEpisode } from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { Play } from "lucide-react"
import { MediaRow } from "../anime/common/anime-scroll-row"
import { AnimeTitle } from "../anime/common/anime-title"
import { planningNewEpisodesAtom } from "./atoms"

const relativeTime = (date: Date) => {
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour")
  return formatter.format(Math.round(hours / 24), "day")
}

const recentWindowMs = 14 * 24 * 60 * 60 * 1000

const remainingEpisodes = (item: LibraryNewEpisode) =>
  item.latestAiredEpisode - item.progress

const isRecent = (item: LibraryNewEpisode) =>
  item.latestAiredAt !== null &&
  Date.now() - item.latestAiredAt.getTime() < recentWindowMs

// Availability is only known for airing shows the sync has checked, so an
// unchecked (null) value is not treated as missing.
const isBehindProviders = (item: LibraryNewEpisode) =>
  item.availableEpisode !== null && item.availableEpisode <= item.progress

const summary = (item: LibraryNewEpisode) => {
  const next = `Episode ${item.progress + 1}`
  const remaining = remainingEpisodes(item)
  if (isBehindProviders(item)) return `${next} · not on providers yet`
  if (item.status === "planning") return `${next} · ${remaining} out`
  if (isRecent(item)) {
    return remaining > 1 ? `${next} · ${remaining} new` : `${next} · new`
  }
  return `${next} · ${remaining} left`
}

export function PlanToWatchAiringRow() {
  const result = useAtomValue(planningNewEpisodesAtom)

  return Result.builder(result)
    .onSuccess((items) =>
      items.length === 0 ? null : (
        <MediaRow
          title="Now airing from your plan to watch"
          eyebrow="Plan to watch"
        >
          {items.map((item) => (
            <div
              key={item.anime.malId}
              className="w-44 shrink-0 sm:w-52 md:w-60 lg:w-64"
            >
              <UpNextCard item={item} />
            </div>
          ))}
        </MediaRow>
      )
    )
    .orElse(() => null)
}

export function UpNextCard({ item }: { item: LibraryNewEpisode }) {
  const image = item.nextEpisodeImage ?? item.anime.coverImage
  const available = !isBehindProviders(item)
  const recent = isRecent(item)

  return (
    <Link
      {...(available
        ? { to: "/play/$malId", params: { malId: item.anime.malId } }
        : { to: "/series/$id", params: { id: item.anime.malId } })}
      className="group flex min-w-0 flex-col gap-2 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted ring-1 ring-white/10 transition group-hover:ring-primary/50">
        {image ? (
          <img
            src={image}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full object-cover object-center transition duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {!available || recent ? (
          <span className="absolute top-2 left-2">
            <Badge variant={available ? "default" : "secondary"}>
              {available ? "New" : "Aired"}
            </Badge>
          </span>
        ) : null}

        {available ? (
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-11 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/25 backdrop-blur-md transition group-hover:bg-primary group-hover:ring-primary">
              <Play className="size-5 fill-current" />
            </span>
          </span>
        ) : null}

        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-2.5">
          <span className="truncate text-[11px] font-medium text-white/85">
            {summary(item)}
          </span>
          {item.latestAiredAt && recent ? (
            <span className="truncate text-[11px] text-white/60">
              Episode {item.latestAiredEpisode} aired{" "}
              {relativeTime(item.latestAiredAt)}
            </span>
          ) : null}
        </span>
      </div>

      <h3 className="line-clamp-1 text-sm font-medium transition-colors group-hover:text-primary">
        <AnimeTitle title={item.anime.title} />
      </h3>
    </Link>
  )
}
