import type { StreamPlayback } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Check, Maximize2 } from "lucide-react"
import { NextAiringNotice } from "../../anime/schedule/next-airing-notice"
import { episodeLabel, episodeTitle } from "../player-format"
import type { PlayerPreferences } from "../preferences"
import {
  playerPreferencesAtom,
  updatePlayerPreferencesAtom,
} from "../preferences"

type ToggleKey = "autoplay" | "autoNext" | "autoSkipIntro" | "autoSkipOutro"

const toggles: ReadonlyArray<{ key: ToggleKey; label: string }> = [
  { key: "autoplay", label: "Autoplay" },
  { key: "autoNext", label: "Auto next" },
  { key: "autoSkipIntro", label: "Skip intro" },
  { key: "autoSkipOutro", label: "Skip outro" },
]

export function PlayerTheaterBar({ playback }: { playback: StreamPlayback }) {
  const preferences = useAtomValue(playerPreferencesAtom)
  const updatePreferences = useAtomSet(updatePlayerPreferencesAtom)
  const title = episodeTitle(playback.episode)

  return (
    <div className="hidden flex-col gap-4 md:flex">
      <div className="flex flex-wrap items-center gap-2">
        {toggles.map((toggle) => (
          <TogglePill
            key={toggle.key}
            label={toggle.label}
            active={preferences[toggle.key]}
            onToggle={() =>
              updatePreferences({
                [toggle.key]: !preferences[toggle.key],
              } satisfies Partial<PlayerPreferences>)
            }
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto text-white/70 hover:bg-white/10 hover:text-white"
          onClick={() => updatePreferences({ viewMode: "immersive" })}
        >
          <Maximize2 data-icon="inline-start" />
          Immersive
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs font-medium tracking-wider text-white/50 uppercase">
          {episodeLabel(playback.episode)}
        </p>
        <h2 className="font-heading text-lg leading-snug font-semibold text-white">
          {title ?? episodeLabel(playback.episode)}
        </h2>
        {playback.episode.description ? (
          <p className="max-w-3xl text-sm leading-relaxed text-white/65">
            {playback.episode.description}
          </p>
        ) : null}
        <NextAiringNotice
          nextAiringEpisode={playback.anime.nextAiringEpisode}
          className="mt-1"
        />
      </div>
    </div>
  )
}

function TogglePill({
  label,
  active,
  onToggle,
}: {
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
        active
          ? "border-primary/60 bg-primary/20 text-white"
          : "border-white/15 text-white/60 hover:border-white/30 hover:text-white"
      )}
    >
      {active ? <Check className="size-3.5" /> : null}
      {label}
    </button>
  )
}
