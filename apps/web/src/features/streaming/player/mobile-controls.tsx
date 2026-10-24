import type { StreamPlayback } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { cn } from "@animekaiser/ui/lib/utils"
import { Link } from "@tanstack/react-router"
import {
  ArrowLeft,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
} from "lucide-react"
import { AnimeTitle } from "../../anime/common/anime-title"
import { episodeLabel } from "../player-format"
import { PlayerSettingsPopover } from "./settings-popover"
import { PlayerTimeline, type TimelineLive } from "./timeline"

export function PlayerMobileControls({
  playback,
  currentTime,
  duration,
  bufferedEnd,
  onSeek,
  live,
  playing,
  loading,
  fullscreen,
  onTogglePlayback,
  onToggleFullscreen,
  onSeekBy,
  controlsVisible,
  playerPortalContainer,
  onOpenEpisodes,
  onOpenSources,
}: {
  playback: StreamPlayback
  currentTime: number
  duration: number
  bufferedEnd: number
  onSeek: (value: string) => void
  live: TimelineLive | null
  playing: boolean
  loading: boolean
  fullscreen: boolean
  onTogglePlayback: () => void
  onToggleFullscreen: () => void
  onSeekBy: (seconds: number) => void
  controlsVisible: boolean
  playerPortalContainer: HTMLElement | null
  onOpenEpisodes: () => void
  onOpenSources: () => void
}) {
  return (
    <>
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-30 flex items-center gap-1 bg-gradient-to-b from-black/80 to-transparent p-1 pb-4 transition-opacity phone-landscape:p-2 phone-landscape:pb-8 duration-200",
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-white hover:bg-white/10 hover:text-white"
        >
          <Link to="/series/$id" params={{ id: playback.anime.malId }}>
            <ArrowLeft />
            <span className="sr-only">Back to series</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-white phone-landscape:text-sm">
            <AnimeTitle title={playback.anime.title} />
          </p>
          <p className="truncate text-[11px] leading-tight text-white/70 phone-landscape:text-xs">
            {episodeLabel(playback.episode)}
          </p>
        </div>
        <PlayerSettingsPopover
          portalContainer={playerPortalContainer}
          playback={playback}
          onOpenEpisodes={onOpenEpisodes}
          onOpenSources={onOpenSources}
        />
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-8 transition-opacity duration-200 phone-landscape:gap-14",
          controlsVisible ? "opacity-100 *:pointer-events-auto" : "opacity-0"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white phone-landscape:size-12 [&_svg]:size-5 phone-landscape:[&_svg]:size-6"
          onClick={() => onSeekBy(-10)}
        >
          <RotateCcw />
          <span className="sr-only">Back 10 seconds</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-12 rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/75 hover:text-white phone-landscape:size-16 [&_svg]:size-6 phone-landscape:[&_svg]:size-8"
          onClick={onTogglePlayback}
        >
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : playing ? (
            <Pause />
          ) : (
            <Play />
          )}
          <span className="sr-only">{playing ? "Pause" : "Play"}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white phone-landscape:size-12 [&_svg]:size-5 phone-landscape:[&_svg]:size-6"
          onClick={() => onSeekBy(10)}
        >
          <RotateCw />
          <span className="sr-only">Forward 10 seconds</span>
        </Button>
      </div>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 flex items-center gap-1 bg-gradient-to-t from-black/85 to-transparent px-2 pt-4 transition-opacity phone-landscape:px-3 phone-landscape:pt-8 phone-landscape:pb-1 duration-200",
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div className="min-w-0 flex-1">
          <PlayerTimeline
            playback={playback}
            currentTime={currentTime}
            duration={duration}
            bufferedEnd={bufferedEnd}
            onSeek={onSeek}
            live={live}
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-white hover:bg-white/10 hover:text-white"
          onClick={onToggleFullscreen}
        >
          {fullscreen ? <Minimize /> : <Maximize />}
          <span className="sr-only">
            {fullscreen ? "Exit full screen" : "Full screen"}
          </span>
        </Button>
      </div>
    </>
  )
}
