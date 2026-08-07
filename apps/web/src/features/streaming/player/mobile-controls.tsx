import type { StreamPlayback } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { useIsMobile } from "@animekaiser/ui/hooks/use-mobile"
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
import { PlayerTimeline } from "./timeline"

export function PlayerMobileControls({
  playback,
  currentTime,
  duration,
  bufferedEnd,
  onSeek,
  playing,
  loading,
  fullscreen,
  onTogglePlayback,
  onToggleFullscreen,
  onSeekBy,
  controlsVisible,
  playerPortalContainer,
}: {
  playback: StreamPlayback
  currentTime: number
  duration: number
  bufferedEnd: number
  onSeek: (value: string) => void
  playing: boolean
  loading: boolean
  fullscreen: boolean
  onTogglePlayback: () => void
  onToggleFullscreen: () => void
  onSeekBy: (seconds: number) => void
  controlsVisible: boolean
  playerPortalContainer: HTMLElement | null
}) {
  const isMobile = useIsMobile()
  const mediaLoading = loading || !playing

  return (
    <>
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-30 flex items-center gap-1 bg-gradient-to-b from-black/85 to-transparent p-2 pb-6 transition-opacity duration-200 md:hidden",
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="shrink-0 text-white hover:bg-white/10 hover:text-white"
        >
          <Link to="/series/$id" params={{ id: playback.anime.malId }}>
            <ArrowLeft />
            <span className="sr-only">Back to series</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            <AnimeTitle title={playback.anime.title} />
          </p>
          <p className="truncate text-xs text-white/55">
            {episodeLabel(playback.episode)}
          </p>
        </div>
        {isMobile ? (
          <PlayerSettingsPopover
            portalContainer={playerPortalContainer}
            playback={playback}
          />
        ) : null}
      </div>

      <div
        className={cn(
          "absolute inset-0 z-20 flex items-center justify-center gap-6 transition-opacity duration-200 md:hidden",
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-12 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white [&_svg]:size-6"
          onClick={() => onSeekBy(-10)}
        >
          <RotateCcw />
          <span className="sr-only">Back 10 seconds</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-16 rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white [&_svg]:size-8"
          onClick={onTogglePlayback}
        >
          {mediaLoading ? (
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
          className="size-12 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white [&_svg]:size-6"
          onClick={() => onSeekBy(10)}
        >
          <RotateCw />
          <span className="sr-only">Forward 10 seconds</span>
        </Button>
      </div>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 flex items-center gap-2 bg-gradient-to-t from-black via-black/70 to-transparent px-2 pt-8 pb-1 transition-opacity duration-200 md:hidden",
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
