import type { StreamPlayback } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { cn } from "@animekaiser/ui/lib/utils"
import { Loader2, SkipForward } from "lucide-react"
import type { PlayerPreferences } from "../preferences"
import { subtitleStyle } from "../subtitle-settings"

export function PlayerSubtitleOverlay({
  html,
  mode,
  compact,
  controlsVisible,
  preferences,
}: {
  html: string | null
  mode: "full" | "mini"
  compact: boolean
  controlsVisible: boolean
  preferences: PlayerPreferences
}) {
  if (!html) return null

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-20 mx-auto text-center font-semibold text-white transition-[bottom] duration-200",
        mode === "mini"
          ? "inset-x-3 bottom-3 line-clamp-2 text-xs"
          : compact
            ? cn(
                "inset-x-3 text-sm phone-landscape:inset-x-10 phone-landscape:text-base",
                controlsVisible
                  ? "bottom-10 phone-landscape:bottom-12"
                  : "bottom-2 phone-landscape:bottom-4"
              )
            : cn(
                "inset-x-6 max-w-5xl text-2xl",
                controlsVisible ? "bottom-40" : "bottom-10"
              )
      )}
    >
      <span
        className={cn(
          "rounded-lg box-decoration-clone",
          mode === "full" && !compact
            ? "px-2.5 py-1 leading-relaxed"
            : "px-1.5 py-0.5 leading-snug"
        )}
        style={subtitleStyle(preferences)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

export function PlayerSkipButton({
  kind,
  compact,
  segment,
  currentTime,
  duration,
  onSkip,
}: {
  kind: "intro" | "outro"
  compact: boolean
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
      className="pointer-events-auto border border-white/35 bg-black/70 text-white shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur-md animate-in fade-in-0 hover:border-white hover:bg-white hover:text-black"
      variant="secondary"
      size={compact ? "sm" : "default"}
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
