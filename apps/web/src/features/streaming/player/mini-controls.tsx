import type { StreamPlayback } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { Link } from "@tanstack/react-router"
import {
  Loader2,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  X,
} from "lucide-react"

export function PlayerMiniControls({
  playback,
  serverId,
  playing,
  loading,
  onTogglePlayback,
  onSeekBy,
  onClose,
}: {
  playback: StreamPlayback
  serverId: string | undefined
  playing: boolean
  loading: boolean
  onTogglePlayback: () => void
  onSeekBy: (seconds: number) => void
  onClose?: () => void
}) {
  const mediaLoading = loading || !playing

  return (
    <>
      <div className="absolute top-2 right-2 z-50 flex cursor-default items-center gap-1 opacity-0 transition-opacity group-hover/miniplayer:opacity-100 focus-within:opacity-100">
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          className="bg-black/45 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white"
        >
          <Link
            to="/watch/$malId/$provider/$episodeId"
            params={{
              malId: playback.anime.malId,
              provider: playback.provider,
              episodeId: playback.episode.id,
            }}
            search={{ audio: playback.audio, serverId }}
          >
            <Maximize />
            <span className="sr-only">Return to full player</span>
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="bg-black/45 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white"
          onClick={onClose}
        >
          <X />
          <span className="sr-only">Close player</span>
        </Button>
      </div>
      <div className="absolute inset-0 z-30 flex cursor-default items-center justify-center gap-2 bg-black/20 opacity-0 transition-opacity group-hover/miniplayer:opacity-100 focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon-sm"
          className="bg-black/45 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white"
          onClick={() => onSeekBy(-5)}
        >
          <RotateCcw />
          <span className="sr-only">Back 5 seconds</span>
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full bg-white text-black hover:bg-white/85"
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
          size="icon-sm"
          className="bg-black/45 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white"
          onClick={() => onSeekBy(5)}
        >
          <RotateCw />
          <span className="sr-only">Forward 5 seconds</span>
        </Button>
      </div>
    </>
  )
}
