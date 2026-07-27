import { Switch } from "@animekaiser/ui/components/switch"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import {
  playerPreferencesAtom,
  updatePlayerPreferencesAtom,
} from "../streaming/preferences"
import { SubtitleSettings } from "../streaming/subtitle-settings"
import { PanelCard } from "./settings-shared"

type PlayerPreferenceKey =
  | "autoplay"
  | "autoNext"
  | "autoSkipIntro"
  | "autoSkipOutro"
  | "syncLibraryOnFinish"

const preferenceRows: ReadonlyArray<{
  key: PlayerPreferenceKey
  title: string
  description: string
}> = [
  {
    key: "autoplay",
    title: "Autoplay episodes",
    description: "Start playback automatically when a stream is ready.",
  },
  {
    key: "autoNext",
    title: "Auto next episode",
    description: "Move to the next available episode when playback ends.",
  },
  {
    key: "autoSkipIntro",
    title: "Auto skip intro",
    description: "Skip opening segments automatically when timing data exists.",
  },
  {
    key: "autoSkipOutro",
    title: "Auto skip outro",
    description: "Skip ending segments automatically when timing data exists.",
  },
  {
    key: "syncLibraryOnFinish",
    title: "External list sync",
    description: "Update linked list providers after you finish an episode.",
  },
]

export function PlayerPanel() {
  const preferences = useAtomValue(playerPreferencesAtom)
  const updatePreferences = useAtomSet(updatePlayerPreferencesAtom)

  const update = (key: PlayerPreferenceKey, checked: boolean) => {
    updatePreferences({ [key]: checked })
  }

  return (
    <div className="flex flex-col gap-4">
      {preferenceRows.map((row) => (
        <PanelCard key={row.key}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">{row.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {row.description}
              </p>
            </div>
            <Switch
              checked={preferences[row.key]}
              onCheckedChange={(checked) => update(row.key, checked)}
            />
          </div>
        </PanelCard>
      ))}
      <PanelCard>
        <div className="mb-4">
          <h3 className="font-semibold">Subtitle appearance</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tune captions once; the player popover and watch page use the same
            settings.
          </p>
        </div>
        <SubtitleSettings />
      </PanelCard>
    </div>
  )
}
