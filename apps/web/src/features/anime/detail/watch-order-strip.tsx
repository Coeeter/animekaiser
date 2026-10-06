import { cn } from "@animekaiser/ui/lib/utils"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { CheckCircle2 } from "lucide-react"
import { AnimeTitle } from "../common/anime-title"
import { formatAnimeFormat } from "../common/format"
import { type WatchOrderItem, watchOrderItemsAtom } from "./atoms"

const statusLabel = ({ anime, entry }: WatchOrderItem) => {
  if (anime.status === "NOT_YET_RELEASED") return "Upcoming"
  if (!entry) return null
  if (entry.status === "completed") return "Completed"
  if (entry.status === "watching" || entry.status === "rewatching") {
    return anime.episodes
      ? `Watching · ${entry.progress}/${anime.episodes}`
      : `Watching · ${entry.progress} eps`
  }
  if (entry.status === "planning") return "Planned"
  if (entry.status === "paused") return "Paused"
  return "Dropped"
}

// Centres the current entry inside the strip without scrolling the page.
const centreInStrip = (node: HTMLElement | null) => {
  const strip = node?.parentElement
  if (!node || !strip) return
  strip.scrollLeft =
    node.offsetLeft - (strip.clientWidth - node.clientWidth) / 2
}

export function WatchOrderStrip({ malId }: { malId: number }) {
  const items = Result.builder(useAtomValue(watchOrderItemsAtom(malId)))
    .onSuccess((value) => value)
    .orElse(() => [])

  if (items.length < 2) return null
  const position = items.findIndex((item) => item.anime.malId === malId) + 1

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-base font-bold">Watch order</h2>
        {position > 0 ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {position} of {items.length}
          </span>
        ) : null}
      </div>
      <div className="relative -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 no-scrollbar md:-mx-6 md:px-6">
        {items.map((item, index) => (
          <WatchOrderCard
            key={item.anime.malId}
            item={item}
            position={index + 1}
            current={item.anime.malId === malId}
          />
        ))}
      </div>
    </section>
  )
}

function WatchOrderCard({
  item,
  position,
  current,
}: {
  item: WatchOrderItem
  position: number
  current: boolean
}) {
  const { anime } = item
  const status = statusLabel(item)
  const completed = item.entry?.status === "completed"
  const content = (
    <>
      <div className="relative aspect-2/3 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
        {anime.coverImage ? (
          <img
            src={anime.coverImage}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        {current ? (
          <span className="w-fit rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary-foreground uppercase">
            You're here
          </span>
        ) : (
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase tabular-nums">
            {[
              position,
              anime.format && formatAnimeFormat(anime.format),
              anime.seasonYear,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <p className="line-clamp-2 text-sm leading-snug font-medium">
          <AnimeTitle title={anime.title} />
        </p>
        {status ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {completed ? (
              <CheckCircle2 className="size-3 text-emerald-400" />
            ) : null}
            {status}
          </p>
        ) : null}
      </div>
    </>
  )
  const className = cn(
    "flex w-60 shrink-0 snap-start items-center gap-3 rounded-xl border bg-card p-2.5",
    current && "border-primary/60 ring-1 ring-primary/30"
  )

  if (current) {
    return (
      <div ref={centreInStrip} className={className} aria-current="page">
        {content}
      </div>
    )
  }

  return (
    <Link
      to="/series/$id"
      params={{ id: anime.malId }}
      preload="intent"
      className={cn(className, "transition hover:bg-accent")}
    >
      {content}
    </Link>
  )
}
