import { Button } from "@animekaiser/ui/components/button"
import { Play, X } from "lucide-react"
import { AnimeTitle } from "../../anime/common/anime-title"
import type { NextSeason } from "../atoms"

export function PlayerNextSeasonCard({
  nextSeason,
  onPlay,
  onDismiss,
}: {
  nextSeason: NextSeason
  onPlay: () => void
  onDismiss: () => void
}) {
  const { anime } = nextSeason

  return (
    <div className="absolute inset-x-4 bottom-16 z-40 flex justify-center md:bottom-36">
      <div className="flex w-full max-w-md items-center gap-4 rounded-2xl border border-white/10 bg-black/80 p-3 text-white shadow-2xl backdrop-blur-xl">
        {anime.coverImage ? (
          <img
            src={anime.coverImage}
            alt=""
            className="aspect-2/3 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wider text-white/60 uppercase">
              Up next in the story
            </p>
            <p className="line-clamp-2 text-sm font-semibold">
              <AnimeTitle title={anime.title} />
            </p>
          </div>
          <Button size="sm" className="w-fit" onClick={onPlay}>
            <Play data-icon="inline-start" />
            Start watching
          </Button>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="self-start rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
          onClick={onDismiss}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
