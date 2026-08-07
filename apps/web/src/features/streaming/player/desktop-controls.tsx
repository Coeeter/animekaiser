import type { StreamPlayback } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { useIsMobile } from "@animekaiser/ui/hooks/use-mobile"
import { cn } from "@animekaiser/ui/lib/utils"
import { Link } from "@tanstack/react-router"
import {
  ArrowLeft,
  ListVideo,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  Server,
  Volume2,
  VolumeX,
} from "lucide-react"
import { AnimeTitle } from "../../anime/common/anime-title"
import { episodeLabel, episodeTitle, providerLabel } from "../player-format"
import { PlayerSettingsPopover } from "./settings-popover"
import { PlayerTimeline } from "./timeline"

export function PlayerDesktopControls({
  playback,
  currentTime,
  duration,
  bufferedEnd,
  onSeek,
  playing,
  loading,
  muted,
  volume,
  fullscreen,
  onTogglePlayback,
  onToggleMute,
  onVolumeChange,
  onToggleFullscreen,
  onOpenEpisodes,
  onOpenServers,
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
  muted: boolean
  volume: number
  fullscreen: boolean
  onTogglePlayback: () => void
  onToggleMute: () => void
  onVolumeChange: (value: number) => void
  onToggleFullscreen: () => void
  onOpenEpisodes: () => void
  onOpenServers: () => void
  controlsVisible: boolean
  playerPortalContainer: HTMLElement | null
}) {
  const isMobile = useIsMobile()
  const mediaLoading = loading || !playing
  const displayTitle = episodeTitle(playback.episode)

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 hidden flex-col gap-2 bg-gradient-to-t from-black via-black/75 to-transparent p-3 transition-opacity duration-200 sm:gap-3 sm:p-4 md:flex",
        controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <div className="flex items-center gap-2">
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
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={onTogglePlayback}
        >
          <p className="truncate text-sm font-medium text-white">
            <AnimeTitle title={playback.anime.title} />
          </p>
          <p
            className="truncate text-xs text-white/55"
            title={`${episodeLabel(playback.episode)}${displayTitle ? ` · ${displayTitle}` : ""}`}
          >
            {episodeLabel(playback.episode)}
            {displayTitle ? ` · ${displayTitle}` : ""}
          </p>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="max-w-44 text-white hover:bg-white/10 hover:text-white"
          onClick={onOpenEpisodes}
        >
          <ListVideo />
          <span
            className="truncate"
            title={`${providerLabel(playback.provider)} episodes`}
          >
            {providerLabel(playback.provider)} episodes
          </span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="max-w-40 text-white hover:bg-white/10 hover:text-white"
          onClick={onOpenServers}
        >
          <Server />
          <span className="truncate" title={playback.server.name}>
            {playback.server.name}
          </span>
        </Button>
      </div>

      <PlayerTimeline
        playback={playback}
        currentTime={currentTime}
        duration={duration}
        bufferedEnd={bufferedEnd}
        onSeek={onSeek}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={onTogglePlayback}
          >
            {mediaLoading ? (
              <Loader2 className="animate-spin" />
            ) : playing ? (
              <Pause />
            ) : (
              <Play />
            )}
            <span className="sr-only">
              {mediaLoading ? "Loading" : playing ? "Pause" : "Play"}
            </span>
          </Button>
          <div className="group/volume flex items-center gap-1 rounded-full focus-within:bg-white/10 hover:bg-white/10">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-transparent hover:text-white"
              onClick={onToggleMute}
            >
              {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
              <span className="sr-only">{muted ? "Unmute" : "Mute"}</span>
            </Button>
            <div className="grid w-0 overflow-hidden opacity-0 transition-[width,opacity] duration-150 group-focus-within/volume:w-24 group-focus-within/volume:opacity-100 group-hover/volume:w-24 group-hover/volume:opacity-100">
              <input
                aria-label="Volume"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(event) => {
                  onVolumeChange(Number(event.currentTarget.value))
                }}
                className="h-8 w-24 cursor-pointer accent-white"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isMobile ? null : (
            <PlayerSettingsPopover
              portalContainer={playerPortalContainer}
              playback={playback}
            />
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={onToggleFullscreen}
          >
            {fullscreen ? <Minimize /> : <Maximize />}
            <span className="sr-only">
              {fullscreen ? "Exit full screen" : "Full screen"}
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
