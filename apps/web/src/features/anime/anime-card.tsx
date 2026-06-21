import { useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import type { AnimeItem } from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Star } from "lucide-react"
import { formatAnimeFormat } from "./format"
import {
  animeTitlePreferenceAtom,
  getAnimeSubtitle,
  getAnimeTitle,
} from "./title"

export function AnimeCard({
  anime,
  compact = false,
}: {
  anime: AnimeItem
  compact?: boolean
}) {
  const preference = useAtomValue(animeTitlePreferenceAtom)
  const title = getAnimeTitle(anime.title, preference)
  const subtitle = getAnimeSubtitle(anime.title, preference)

  return (
    <Link
      to="/series/$id"
      params={{ id: anime.malId }}
      preload="intent"
      className="group flex min-w-0 flex-col gap-2.5"
    >
      <div className="relative overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-border/50">
        {anime.coverImage ? (
          <img
            src={anime.coverImage}
            alt=""
            loading="lazy"
            className="aspect-2/3 w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="aspect-2/3 w-full bg-muted" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          {anime.averageScore !== null ? (
            <Badge className="gap-1 border-0 bg-black/60 text-white backdrop-blur-sm">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              {anime.averageScore}%
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold group-hover:text-primary">
          {title}
        </h3>
        {!compact && subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
        <p className="truncate text-xs text-muted-foreground">
          {[formatAnimeFormat(anime.format), anime.seasonYear]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  )
}
