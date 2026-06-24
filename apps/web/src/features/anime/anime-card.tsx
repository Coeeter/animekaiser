import { useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import type { AnimeItem } from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { Star } from "lucide-react"
import { AnimeTitle } from "./anime-title"
import { formatAnimeFormat } from "./format"
import { animeTitlePreferenceAtom, getAnimeTitle } from "./title"

const formatScore = (score: number | null) => (score ? `${score}%` : "NR")

export function AnimeCard({
  anime,
  compact = false,
}: {
  anime: AnimeItem
  compact?: boolean
}) {
  const titlePreference = useAtomValue(animeTitlePreferenceAtom)
  const title = getAnimeTitle(anime.title, titlePreference)

  return (
    <Link
      to="/series/$id"
      params={{ id: anime.malId }}
      preload="intent"
      className="group flex min-w-0 flex-col gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-xl bg-muted ring-1 ring-border transition duration-300 group-hover:-translate-y-0.5 group-hover:ring-primary/60">
        {anime.coverImage ? (
          <img
            src={anime.coverImage}
            alt={title}
            className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
            {title}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-2 left-2">
          <Badge
            variant="secondary"
            className="gap-1 border-0 bg-black/60 text-white backdrop-blur-sm"
          >
            <Star className="size-3 fill-amber-400 text-amber-400" />
            {formatScore(anime.averageScore)}
          </Badge>
        </div>
        <div className="absolute right-2 bottom-2 left-2 flex flex-wrap gap-1">
          {anime.format ? (
            <Badge
              variant="secondary"
              className="border-0 bg-white/15 text-[10px] text-white backdrop-blur-sm"
            >
              {formatAnimeFormat(anime.format)}
            </Badge>
          ) : null}
          {anime.seasonYear ? (
            <Badge
              variant="secondary"
              className="border-0 bg-white/15 text-[10px] text-white backdrop-blur-sm"
            >
              {anime.seasonYear}
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3
          className={cn(
            "line-clamp-2 min-h-10 text-sm leading-5 font-medium text-foreground transition-colors group-hover:text-primary",
            compact && "min-h-0 text-xs leading-4"
          )}
        >
          <AnimeTitle title={anime.title} />
        </h3>
        <p className="truncate text-xs text-muted-foreground">
          {[formatAnimeFormat(anime.format), anime.seasonYear]
            .filter(Boolean)
            .join(" · ") || "Anime"}
        </p>
      </div>
    </Link>
  )
}
