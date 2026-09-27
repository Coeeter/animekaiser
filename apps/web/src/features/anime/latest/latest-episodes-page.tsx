import type { LatestEpisode } from "@animekaiser/domain"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { Result, useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { Clapperboard } from "lucide-react"
import { DataError } from "../../../components/data-error"
import { PageHero } from "../../../components/page-hero"
import { KaiserRpcClient } from "../../../services/api-clients"
import { AnimeTitle } from "../common/anime-title"
import { formatAnimeFormat } from "../common/format"

const latestEpisodesAtom = KaiserRpcClient.query(
  "ListLatestEpisodes",
  undefined,
  { timeToLive: "5 minutes" }
)

const airedLabel = (airedAt: number) => {
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  const minutes = Math.round((airedAt * 1000 - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour")
  return formatter.format(Math.round(hours / 24), "day")
}

export function LatestEpisodesPage() {
  const result = useAtomValue(latestEpisodesAtom)
  const refresh = useAtomRefresh(latestEpisodesAtom)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <PageHero
        icon={Clapperboard}
        kicker="Just aired"
        title="Latest episodes"
        description="Episodes that aired in the last three days, newest first."
      />
      {Result.builder(result)
        .onInitialOrWaiting(() => <LatestEpisodesPending />)
        .onFailure(() => <DataError onRetry={refresh} />)
        .onSuccess((items) =>
          items.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              Nothing has aired in the last few days.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((item) => (
                <LatestEpisodeCard
                  key={`${item.anime.malId}:${item.episode}`}
                  item={item}
                />
              ))}
            </div>
          )
        )
        .render()}
    </div>
  )
}

function LatestEpisodeCard({ item }: { item: LatestEpisode }) {
  const image =
    item.image ?? item.anime.bannerImage ?? item.anime.coverImage ?? null

  return (
    <Link
      to="/series/$id"
      params={{ id: item.anime.malId }}
      preload="intent"
      className="group flex min-w-0 flex-col gap-2"
    >
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted ring-1 ring-white/10 transition group-hover:ring-primary/50">
        {image ? (
          <img
            src={image}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <span className="absolute top-2 left-2 rounded-md bg-background/85 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums backdrop-blur-sm">
          EP {item.episode}
        </span>
        <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-white/85">
          {airedLabel(item.airedAt)}
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-sm leading-snug font-medium group-hover:text-primary">
          <AnimeTitle title={item.anime.title} />
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {[
            formatAnimeFormat(item.anime.format),
            item.anime.genres.slice(0, 2).join(" · "),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  )
}

function LatestEpisodesPending() {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }, (_item, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  )
}
