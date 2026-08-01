import type { ContinueWatchingItem } from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import { Button } from "@animekaiser/ui/components/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@animekaiser/ui/components/hover-card"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { useIsMobile } from "@animekaiser/ui/hooks/use-mobile"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { Play, Server } from "lucide-react"
import { CardActions } from "../anime/common/anime-card"
import { MediaRow } from "../anime/common/anime-scroll-row"
import { AnimeSubtitle, AnimeTitle } from "../anime/common/anime-title"
import {
  audioLabel,
  formatTime,
  providerLabel,
} from "../streaming/player-format"
import { continueWatchingAtom } from "./atoms"

const continueWatchingLimit = 12

const percentWatched = (item: ContinueWatchingItem) => {
  if (!item.durationSeconds || item.durationSeconds <= 0) return 0
  return Math.min(
    100,
    Math.round((item.positionSeconds / item.durationSeconds) * 100)
  )
}

const remainingLabel = (item: ContinueWatchingItem) => {
  if (!item.durationSeconds || item.durationSeconds <= 0) {
    return `Episode ${item.episode} · ${formatTime(item.positionSeconds)}`
  }

  const remaining = Math.max(0, item.durationSeconds - item.positionSeconds)
  return `Episode ${item.episode} · ${formatTime(remaining)} left`
}

export function ContinueWatchingRow() {
  const result = useAtomValue(continueWatchingAtom(continueWatchingLimit))

  return Result.builder(result)
    .onInitialOrWaiting(() => <ContinueWatchingPending />)
    .onFailure(() => null)
    .onSuccess((items) =>
      items.length === 0 ? null : (
        <MediaRow title="Continue watching">
          {items.map((item) => (
            <ContinueWatchingItemCell key={item.malId} item={item} />
          ))}
        </MediaRow>
      )
    )
    .render()
}

function ContinueWatchingItemCell({ item }: { item: ContinueWatchingItem }) {
  const isMobile = useIsMobile()
  const cell = (
    <div className="w-44 shrink-0 sm:w-52 md:w-60 lg:w-64">
      <ContinueWatchingCard item={item} />
    </div>
  )

  if (isMobile) return cell

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{cell}</HoverCardTrigger>
      <HoverCardContent side="top" align="start" collisionPadding={12}>
        <ContinueWatchingDetails item={item} />
      </HoverCardContent>
    </HoverCard>
  )
}

function ContinueWatchingCard({ item }: { item: ContinueWatchingItem }) {
  const percent = percentWatched(item)

  return (
    <Link
      to="/watch/$malId/$provider/$episodeId"
      params={{
        malId: item.malId,
        provider: item.provider,
        episodeId: item.episodeId,
      }}
      search={{ audio: item.audio, serverId: item.serverId ?? undefined }}
      preload="intent"
      className="group flex min-w-0 flex-col gap-2 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted ring-1 ring-white/10 transition group-hover:ring-primary/50">
        {item.anime.coverImage ? (
          <img
            src={item.anime.coverImage}
            alt=""
            className="size-full object-cover object-center transition duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-11 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/25 backdrop-blur-md transition group-hover:bg-primary group-hover:ring-primary">
            <Play className="size-5 fill-current" />
          </span>
        </span>

        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-2.5">
          <span className="truncate text-[11px] font-medium text-white/85">
            {remainingLabel(item)}
          </span>
          <span className="h-1 overflow-hidden rounded-full bg-white/25">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${percent}%` }}
            />
          </span>
        </span>
      </div>

      <h3 className="line-clamp-1 text-sm font-medium transition-colors group-hover:text-primary">
        <AnimeTitle title={item.anime.title} />
      </h3>
    </Link>
  )
}

function ContinueWatchingDetails({ item }: { item: ContinueWatchingItem }) {
  const percent = percentWatched(item)

  return (
    <div className="flex flex-col gap-2">
      <p className="font-heading leading-snug font-semibold">
        <AnimeTitle title={item.anime.title} />
      </p>
      <AnimeSubtitle title={item.anime.title}>
        {(subtitle) => (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </AnimeSubtitle>

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <Badge variant="secondary">Episode {item.episode}</Badge>
        <Badge variant="outline">{providerLabel(item.provider)}</Badge>
        <Badge variant="outline">{audioLabel(item.audio)}</Badge>
        {item.serverName ? (
          <Badge variant="outline">
            <Server data-icon="inline-start" />
            {item.serverName}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5 pt-0.5">
        <span className="h-1 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${percent}%` }}
          />
        </span>
        <p className="text-xs text-muted-foreground">
          {item.durationSeconds
            ? `${formatTime(item.positionSeconds)} of ${formatTime(item.durationSeconds)} · ${percent}% watched`
            : `Stopped at ${formatTime(item.positionSeconds)}`}
        </p>
      </div>

      <CardActions
        malId={item.malId}
        watch={
          <Button asChild size="sm" className="flex-1">
            <Link
              to="/watch/$malId/$provider/$episodeId"
              params={{
                malId: item.malId,
                provider: item.provider,
                episodeId: item.episodeId,
              }}
              search={{
                audio: item.audio,
                serverId: item.serverId ?? undefined,
              }}
            >
              <Play data-icon="inline-start" />
              Resume
            </Link>
          </Button>
        }
      />
    </div>
  )
}

function ContinueWatchingPending() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-6 w-40" />
      <div className="flex gap-3 overflow-hidden md:gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex w-44 shrink-0 flex-col gap-2 sm:w-52 md:w-60 lg:w-64"
          >
            <Skeleton className="aspect-video w-full rounded-2xl" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
