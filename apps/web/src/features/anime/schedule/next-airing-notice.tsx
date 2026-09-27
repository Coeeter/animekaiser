import type { AnimeDetail } from "@animekaiser/domain"
import { cn } from "@animekaiser/ui/lib/utils"
import { CalendarClock } from "lucide-react"
import { NextEpisodeCountdown } from "./next-episode-countdown"

export function NextAiringNotice({
  nextAiringEpisode,
  className,
}: {
  nextAiringEpisode: AnimeDetail["nextAiringEpisode"]
  className?: string
}) {
  if (!nextAiringEpisode || nextAiringEpisode.airingAt * 1000 <= Date.now()) {
    return null
  }

  return (
    <div
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300",
        className
      )}
    >
      <CalendarClock className="size-3.5" />
      <span>
        Episode {nextAiringEpisode.episode} in{" "}
        <NextEpisodeCountdown airingAt={nextAiringEpisode.airingAt} />
      </span>
    </div>
  )
}
