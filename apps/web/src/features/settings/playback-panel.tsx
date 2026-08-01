import { Switch } from "@animekaiser/ui/components/switch"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import {
  playerPreferencesAtom,
  updatePlayerPreferencesAtom,
} from "../streaming/preferences"
import { SubtitleSettings } from "../streaming/subtitle-settings"
import { SettingCard, SettingHeading } from "./settings-shared"

type PlayerPreferenceKey =
  | "autoplay"
  | "autoNext"
  | "autoSkipIntro"
  | "autoSkipOutro"
  | "syncLibraryOnFinish"

const preferenceRows: ReadonlyArray<{
  id: string
  key: PlayerPreferenceKey
  title: string
  description: string
}> = [
  {
    id: "playback.autoplay",
    key: "autoplay",
    title: "Autoplay episodes",
    description: "Start playback automatically when a stream is ready.",
  },
  {
    id: "playback.autoNext",
    key: "autoNext",
    title: "Auto next episode",
    description: "Move to the next available episode when playback ends.",
  },
  {
    id: "playback.autoSkipIntro",
    key: "autoSkipIntro",
    title: "Auto skip intro",
    description: "Skip opening segments automatically when timing data exists.",
  },
  {
    id: "playback.autoSkipOutro",
    key: "autoSkipOutro",
    title: "Auto skip outro",
    description: "Skip ending segments automatically when timing data exists.",
  },
  {
    id: "playback.syncOnFinish",
    key: "syncLibraryOnFinish",
    title: "External list sync",
    description: "Update linked list providers after you finish an episode.",
  },
]

export function PlaybackPanel() {
  const preferences = useAtomValue(playerPreferencesAtom)
  const updatePreferences = useAtomSet(updatePlayerPreferencesAtom)

  const update = (key: PlayerPreferenceKey, checked: boolean) => {
    updatePreferences({ [key]: checked })
  }

  return (
    <div className="flex flex-col gap-4">
      {preferenceRows.map((row) => (
        <SettingCard id={row.id} className="p-4" key={row.key}>
          <SettingHeading
            title={row.title}
            description={row.description}
            action={
              <Switch
                checked={preferences[row.key]}
                onCheckedChange={(checked) => update(row.key, checked)}
              />
            }
          />
        </SettingCard>
      ))}
      <SettingCard id="playback.subtitles">
        <div className="mb-4">
          <SettingHeading
            title="Subtitle appearance"
            description="Tune captions once; the player popover and watch page use the same settings."
          />
        </div>
        <SubtitleSettings />
      </SettingCard>
    </div>
  )
}
