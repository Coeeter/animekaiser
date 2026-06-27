import { useAtom } from "@effect-atom/atom-react"
import { Switch } from "@workspace/ui/components/switch"
import {
  playerPreferencesAtom,
  writeStoredPlayerPreferences,
} from "../streaming/preferences"
import type { PlayerPreferences } from "../streaming/preferences"
import { PanelCard } from "./settings-shared"

type PlayerPreferenceKey = keyof PlayerPreferences

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
    key: "syncLibraryOnFinish",
    title: "Sync library progress",
    description:
      "Update your local library progress after you finish an episode.",
  },
]

export function PlayerPanel() {
  const [preferences, setPreferences] = useAtom(playerPreferencesAtom)

  const update = (key: PlayerPreferenceKey, checked: boolean) => {
    const next = { ...preferences, [key]: checked }
    setPreferences(next)
    writeStoredPlayerPreferences(next)
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
    </div>
  )
}
