import type { AnimeDetail } from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { BookmarkPlus, Play, Star } from "lucide-react"
import { AnimeTitle } from "./anime-title"
import { formatAnimeMeta } from "./format"

export function DetailHero({
  anime,
  onAddToLibrary,
}: {
  anime: AnimeDetail
  onAddToLibrary: () => void
}) {
  return (
    <div className="relative min-h-72 overflow-hidden border-b bg-muted md:min-h-96">
      {(anime.bannerImage ?? anime.coverImage) ? (
        <img
          src={anime.bannerImage ?? anime.coverImage ?? ""}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-black/20" />
      <div className="relative mx-auto flex min-h-72 max-w-7xl items-end gap-5 p-4 md:min-h-96 md:p-6">
        {anime.coverImage ? (
          <img
            src={anime.coverImage}
            alt=""
            className="hidden aspect-2/3 w-44 rounded-xl object-cover shadow-2xl ring-1 ring-white/10 sm:block"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-3 pb-2">
          <div className="flex flex-wrap gap-2">
            {anime.averageScore !== null ? (
              <Badge className="gap-1">
                <Star className="size-3 fill-current" />
                {anime.averageScore}%
              </Badge>
            ) : null}
            {anime.format ? (
              <Badge variant="secondary">{anime.format}</Badge>
            ) : null}
            {anime.status ? (
              <Badge variant="outline">
                {anime.status.replaceAll("_", " ")}
              </Badge>
            ) : null}
          </div>
          <h1 className="max-w-4xl font-heading text-3xl font-black tracking-tight text-balance md:text-5xl">
            <AnimeTitle title={anime.title} />
          </h1>
          {anime.title.english && anime.title.english !== anime.title.romaji ? (
            <p className="text-sm text-muted-foreground">
              {anime.title.english}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {formatAnimeMeta(anime.format, anime.status, anime.episodes)}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={onAddToLibrary}>
              <BookmarkPlus />
              Add to list
            </Button>
            {anime.trailer ? (
              <Button asChild variant="secondary">
                <a
                  href={
                    anime.trailer.site === "youtube"
                      ? `https://youtube.com/watch?v=${anime.trailer.id}`
                      : anime.trailer.id
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  <Play />
                  Trailer
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
