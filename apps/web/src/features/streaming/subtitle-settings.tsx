import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Button } from "@workspace/ui/components/button"
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"
import type { CSSProperties } from "react"
import type { PlayerPreferences } from "./preferences"
import {
  playerPreferencesAtom,
  subtitlePreferenceDefaults,
  updatePlayerPreferencesAtom,
} from "./preferences"

const textColors = [
  "#ffffff",
  "#facc15",
  "#38bdf8",
  "#f9a8d4",
  "#86efac",
] as const

const backgroundColors = ["#000000", "#111827", "#3f1d1d", "#172554"] as const

export const subtitleStyle = (
  preferences: PlayerPreferences
): CSSProperties => ({
  color: preferences.subtitleColor,
  backgroundColor: `${preferences.subtitleBackgroundColor}${Math.round(
    (preferences.subtitleBackgroundOpacityPercent / 100) * 255
  )
    .toString(16)
    .padStart(2, "0")}`,
  fontSize: `${preferences.subtitleSizePercent}%`,
  textShadow: preferences.subtitleShadow
    ? "0 2px 4px rgba(0,0,0,.95), 0 0 8px rgba(0,0,0,.9)"
    : "none",
})

export function SubtitleSettings({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  const preferences = useAtomValue(playerPreferencesAtom)
  const updatePreferences = useAtomSet(updatePlayerPreferencesAtom)

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <SubtitlePreview preferences={preferences} compact={compact} />
      <SettingRange
        label="Size"
        value={preferences.subtitleSizePercent}
        min={75}
        max={175}
        step={5}
        valueLabel={`${preferences.subtitleSizePercent}%`}
        compact={compact}
        onValueChange={(subtitleSizePercent) =>
          updatePreferences({ subtitleSizePercent })
        }
      />
      <ColorSwatches
        label="Text"
        value={preferences.subtitleColor}
        colors={textColors}
        compact={compact}
        onValueChange={(subtitleColor) => updatePreferences({ subtitleColor })}
      />
      <ColorSwatches
        label="Background"
        value={preferences.subtitleBackgroundColor}
        colors={backgroundColors}
        compact={compact}
        onValueChange={(subtitleBackgroundColor) =>
          updatePreferences({ subtitleBackgroundColor })
        }
      />
      <SettingRange
        label="Background opacity"
        value={preferences.subtitleBackgroundOpacityPercent}
        min={0}
        max={100}
        step={5}
        valueLabel={`${preferences.subtitleBackgroundOpacityPercent}%`}
        compact={compact}
        onValueChange={(subtitleBackgroundOpacityPercent) =>
          updatePreferences({ subtitleBackgroundOpacityPercent })
        }
      />
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          compact ? "px-4 text-sm" : "text-sm"
        )}
      >
        <span className="font-medium">Shadow</span>
        <Switch
          aria-label="Shadow"
          checked={preferences.subtitleShadow}
          onCheckedChange={(subtitleShadow) =>
            updatePreferences({ subtitleShadow })
          }
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          compact &&
            "mx-4 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
        )}
        onClick={() => updatePreferences(subtitlePreferenceDefaults)}
      >
        Reset subtitles
      </Button>
    </div>
  )
}

function SubtitlePreview({
  preferences,
  compact,
}: {
  preferences: PlayerPreferences
  compact: boolean
}) {
  return (
    <div
      className={cn(
        "grid min-h-32 place-items-center overflow-hidden rounded-xl border bg-[radial-gradient(circle_at_top,#334155,#020617_62%)] p-4",
        compact ? "mx-4 border-white/10" : "border-border"
      )}
    >
      <p className="max-w-full text-center text-xl leading-relaxed font-semibold">
        <span
          className="rounded-lg box-decoration-clone px-2.5 py-1"
          style={subtitleStyle(preferences)}
        >
          I&apos;ll find you under the same sky.
          <br />
          <i>Even if the scene changes.</i>
        </span>
      </p>
    </div>
  )
}

function SettingRange({
  label,
  value,
  min,
  max,
  step,
  valueLabel,
  compact,
  onValueChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  valueLabel: string
  compact: boolean
  onValueChange: (value: number) => void
}) {
  return (
    <label className={cn("flex flex-col gap-2 text-sm", compact && "px-4")}>
      <span className="flex items-center justify-between gap-3">
        <span className="font-medium">{label}</span>
        <span className={compact ? "text-white/55" : "text-muted-foreground"}>
          {valueLabel}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onValueChange(Number(event.currentTarget.value))}
        className={cn(
          "h-2 w-full cursor-pointer",
          compact ? "accent-white" : "accent-primary"
        )}
      />
    </label>
  )
}

function ColorSwatches({
  label,
  value,
  colors,
  compact,
  onValueChange,
}: {
  label: string
  value: string
  colors: ReadonlyArray<string>
  compact: boolean
  onValueChange: (value: string) => void
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        compact && "px-4"
      )}
    >
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className={cn(
              "size-7 rounded-full border transition",
              value === color
                ? compact
                  ? "border-white ring-2 ring-white/40"
                  : "border-foreground ring-2 ring-ring"
                : compact
                  ? "border-white/25"
                  : "border-border"
            )}
            style={{ backgroundColor: color }}
            onClick={() => onValueChange(color)}
          >
            <span className="sr-only">{color}</span>
          </button>
        ))}
        <input
          aria-label={`${label} color`}
          type="color"
          value={value}
          onChange={(event) => onValueChange(event.currentTarget.value)}
          className={cn(
            "size-7 cursor-pointer rounded-full border bg-transparent p-0",
            compact ? "border-white/25" : "border-border"
          )}
        />
      </div>
    </div>
  )
}
