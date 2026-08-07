import type { StreamPlayback } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { cn } from "@animekaiser/ui/lib/utils"
import { Loader2, SkipForward } from "lucide-react"
import type { PlayerPreferences } from "../preferences"
import { subtitleStyle } from "../subtitle-settings"

export function PlayerSubtitleOverlay({
  html,
  mode,
  controlsVisible,
  preferences,
}: {
  html: string | null
  mode: "full" | "mini"
  controlsVisible: boolean
  preferences: PlayerPreferences
}) {
  if (!html) return null

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-20 mx-auto text-center font-semibold text-white transition-[bottom] duration-200",
        mode === "full"
          ? cn(
              "inset-x-4 max-w-5xl text-sm sm:text-lg md:inset-x-6 md:text-2xl",
              controlsVisible
                ? "bottom-12 md:bottom-40"
                : "bottom-4 md:bottom-10"
            )
          : "inset-x-3 bottom-3 line-clamp-2 text-xs"
      )}
    >
      <span
        className={cn(
          "rounded-lg box-decoration-clone leading-relaxed",
          mode === "full" ? "px-2.5 py-1" : "px-1.5 py-0.5"
        )}
        style={subtitleStyle(preferences)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

export function PlayerSkipButton({
  kind,
  segment,
  currentTime,
  duration,
  onSkip,
}: {
  kind: "intro" | "outro"
  segment: StreamPlayback["intro"]
  currentTime: number
  duration: number
  onSkip: (seconds: number) => void
}) {
  if (!segment || currentTime < segment.start || currentTime > segment.end)
    return null

  const target = Math.min(
    segment.end + 2,
    duration > 0 ? duration : segment.end + 2
  )

  return (
    <Button
      className="pointer-events-auto border border-white/35 bg-black/70 text-white shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur-md hover:border-white hover:bg-white hover:text-black"
      variant="secondary"
      size="sm"
      onClick={() => onSkip(target)}
    >
      <SkipForward data-icon="inline-start" />
      Skip {kind}
    </Button>
  )
}

export function PlayerLoadingToast({ visible }: { visible: boolean }) {
  if (!visible) return null

  return (
    <div className="pointer-events-none absolute top-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/75 px-4 py-2 text-sm text-white shadow-2xl backdrop-blur-md">
      <Loader2 className="size-4 animate-spin" />
      Loading stream server…
    </div>
  )
}
