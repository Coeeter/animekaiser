import type { AnimeItem } from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@animekaiser/ui/components/hover-card"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { useIsMobile } from "@animekaiser/ui/hooks/use-mobile"
import { cn } from "@animekaiser/ui/lib/utils"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { CalendarDays, Clock3, Play, Star, Tv } from "lucide-react"
import type { ComponentPropsWithoutRef } from "react"
import { forwardRef } from "react"
import { detailAtom } from "../detail/atoms"
import { AnimeSubtitle, AnimeTitle } from "./anime-title"
import { formatAnimeFormat, formatAnimeStatus } from "./format"
import { animeTitlePreferenceAtom, getAnimeTitle } from "./title"

const stripHtml = (value: string | null) =>
  value?.replace(/<[^>]*>/g, "").trim() || null

const relativeAiringLabel = (airingAt: number) => {
  const seconds = airingAt - Math.floor(Date.now() / 1000)
  if (seconds <= 0) return "airing now"

  const days = Math.floor(seconds / 86400)
  if (days >= 1) return `in ${days}d`

  const hours = Math.floor(seconds / 3600)
  if (hours >= 1) return `in ${hours}h`

  return `in ${Math.max(1, Math.floor(seconds / 60))}m`
}

export function AnimeCard({
  anime,
  compact = false,
  showDetailsOnHover = true,
}: {
  anime: AnimeItem
  compact?: boolean
  showDetailsOnHover?: boolean
}) {
  const isMobile = useIsMobile()

  if (!showDetailsOnHover || isMobile) {
    return <AnimeCardLink anime={anime} compact={compact} />
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <AnimeCardLink anime={anime} compact={compact} />
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" collisionPadding={12}>
        <AnimeCardDetails anime={anime} />
      </HoverCardContent>
    </HoverCard>
  )
}

const AnimeCardLink = forwardRef<
  HTMLAnchorElement,
  { anime: AnimeItem; compact: boolean } & ComponentPropsWithoutRef<"a">
>(({ anime, compact, className, ...props }, ref) => {
  const titlePreference = useAtomValue(animeTitlePreferenceAtom)
  const title = getAnimeTitle(anime.title, titlePreference)
  const airing = anime.status === "RELEASING"

  const meta = [
    formatAnimeFormat(anime.format),
    anime.seasonYear ? String(anime.seasonYear) : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <Link
      ref={ref}
      to="/series/$id"
      params={{ id: anime.malId }}
      preload="intent"
      className={cn(
        "group flex min-w-0 flex-col gap-2.5 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        className
      )}
      {...props}
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-muted ring-1 ring-white/10 transition duration-300 group-hover:ring-primary/50">
        {anime.coverImage ? (
          <img
            src={anime.coverImage}
            alt=""
            className="size-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex size-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
            {title}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-100" />

        {anime.averageScore ? (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            {(anime.averageScore / 10).toFixed(1)}
          </span>
        ) : null}

        {airing ? (
          <span className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Airing
          </span>
        ) : null}

        <span className="absolute inset-x-0 bottom-0 flex translate-y-2 items-center justify-center p-3 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="grid size-9 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-md">
            <Play className="size-4 fill-current" />
          </span>
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <h3
          className={cn(
            "line-clamp-2 text-sm leading-5 font-medium text-foreground transition-colors group-hover:text-primary",
            compact ? "min-h-0" : "min-h-10"
          )}
        >
          <AnimeTitle title={anime.title} />
        </h3>
        <p className="truncate text-xs text-muted-foreground">
          {meta || formatAnimeStatus(anime.status) || "Anime"}
        </p>
      </div>
    </Link>
  )
})
AnimeCardLink.displayName = "AnimeCardLink"

function AnimeCardDetails({ anime }: { anime: AnimeItem }) {
  const status = formatAnimeStatus(anime.status)
  const nextEpisode = anime.nextAiringEpisode

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading leading-snug font-semibold">
            <AnimeTitle title={anime.title} />
          </p>
          <AnimeSubtitle title={anime.title}>
            {(subtitle) => (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </AnimeSubtitle>
        </div>
        {anime.averageScore ? (
          <div className="flex shrink-0 items-center gap-1">
            <Star className="size-4 fill-amber-400 text-amber-400" />
            <span className="text-sm font-semibold">
              {(anime.averageScore / 10).toFixed(1)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Tv className="size-3.5" />
          {formatAnimeFormat(anime.format)}
          {anime.episodes ? ` · ${anime.episodes} eps` : ""}
        </span>
        {anime.duration ? (
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-3.5" />
            {anime.duration} min
          </span>
        ) : null}
        {anime.season || anime.seasonYear ? (
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {[anime.season, anime.seasonYear].filter(Boolean).join(" ")}
          </span>
        ) : null}
      </div>

      {status || nextEpisode ? (
        <div className="flex flex-wrap items-center gap-2">
          {status ? (
            <Badge
              variant={anime.status === "RELEASING" ? "default" : "secondary"}
            >
              {status}
            </Badge>
          ) : null}
          {nextEpisode ? (
            <span className="text-xs text-muted-foreground">
              Ep {nextEpisode.episode}{" "}
              {relativeAiringLabel(nextEpisode.airingAt)}
            </span>
          ) : null}
        </div>
      ) : null}

      <AnimeCardSynopsis malId={anime.malId} />

      {anime.genres.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {anime.genres.slice(0, 5).map((genre) => (
            <Badge key={genre} variant="outline" className="text-[11px]">
              {genre}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AnimeCardSynopsis({ malId }: { malId: number }) {
  const result = useAtomValue(detailAtom(malId))

  return Result.builder(result)
    .onInitialOrWaiting(() => (
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    ))
    .onFailure(() => null)
    .onSuccess((detail) => {
      const description = stripHtml(detail.description)
      if (!description) return null

      return (
        <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )
    })
    .render()
}
