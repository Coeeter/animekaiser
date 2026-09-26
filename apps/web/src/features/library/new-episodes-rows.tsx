import type { LibraryNewEpisode } from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { Play } from "lucide-react"
import { MediaRow } from "../anime/common/anime-scroll-row"
import { AnimeTitle } from "../anime/common/anime-title"
import { planningNewEpisodesAtom, watchingNewEpisodesAtom } from "./atoms"

const relativeTime = (date: Date) => {
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour")
  return formatter.format(Math.round(hours / 24), "day")
}

const newEpisodeCount = (item: LibraryNewEpisode) =>
  item.latestAiredEpisode - item.progress

const isAvailable = (item: LibraryNewEpisode) =>
  item.availableEpisode !== null && item.availableEpisode > item.progress

const summary = (item: LibraryNewEpisode) => {
  const next = `Episode ${item.progress + 1}`
  if (!isAvailable(item)) return `${next} · not on providers yet`
  const count = newEpisodeCount(item)
  return count > 1 ? `${next} · ${count} new` : `${next} · new`
}

export function NewEpisodesRows() {
  return (
    <>
      <NewEpisodesRow
        atom={watchingNewEpisodesAtom}
        title="New episodes"
        eyebrow="From your watching list"
      />
      <NewEpisodesRow
        atom={planningNewEpisodesAtom}
        title="Now airing from your plan to watch"
        eyebrow="Plan to watch"
      />
    </>
  )
}

function NewEpisodesRow({
  atom,
  title,
  eyebrow,
}: {
  atom: typeof watchingNewEpisodesAtom
  title: string
  eyebrow: string
}) {
  const result = useAtomValue(atom)

  return Result.builder(result)
    .onSuccess((items) =>
      items.length === 0 ? null : (
        <MediaRow title={title} eyebrow={eyebrow}>
          {items.map((item) => (
            <div
              key={item.anime.malId}
              className="w-44 shrink-0 sm:w-52 md:w-60 lg:w-64"
            >
              <NewEpisodeCard item={item} />
            </div>
          ))}
        </MediaRow>
      )
    )
    .orElse(() => null)
}

function NewEpisodeCard({ item }: { item: LibraryNewEpisode }) {
  const image = item.nextEpisodeImage ?? item.anime.coverImage
  const available = isAvailable(item)

  return (
    <Link
      to="/series/$id"
      params={{ id: item.anime.malId }}
      preload="intent"
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

        <span className="absolute top-2 left-2">
          <Badge variant={available ? "default" : "secondary"}>
            {available ? "New" : "Aired"}
          </Badge>
        </span>

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
          {item.latestAiredAt ? (
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
