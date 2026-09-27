import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@animekaiser/ui/components/select"
import { Switch } from "@animekaiser/ui/components/switch"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@animekaiser/ui/components/toggle-group"
import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { streamProvidersAtom } from "../streaming/atoms"
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
  | "blurUnwatched"
  | "autoLandscape"

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
  {
    id: "playback.blurUnwatched",
    key: "blurUnwatched",
    title: "Hide spoilers",
    description:
      "Blur thumbnails and hide synopses of episodes you have not watched.",
  },
  {
    id: "playback.autoLandscape",
    key: "autoLandscape",
    title: "Landscape in fullscreen",
    description:
      "Rotate to landscape when the player goes fullscreen on a phone.",
  },
]

const subtitleLanguages = [
  "English",
  "Spanish",
  "Portuguese",
  "French",
  "German",
  "Italian",
  "Arabic",
  "Indonesian",
  "Russian",
]

const automatic = "auto"

function ProviderSelect() {
  const providers = useAtomValue(streamProvidersAtom)
  const { preferredProvider } = useAtomValue(playerPreferencesAtom)
  const updatePreferences = useAtomSet(updatePlayerPreferencesAtom)
  const options = Result.isSuccess(providers) ? providers.value : []
  const value = preferredProvider ?? automatic

  return (
    <Select
      value={value}
      onValueChange={(next) =>
        updatePreferences({
          preferredProvider: next === automatic ? null : next,
        })
      }
    >
      <SelectTrigger className="w-40">
        <SelectValue>
          {options.find((provider) => provider.id === value)?.label ??
            "Automatic"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={automatic}>Automatic</SelectItem>
          {options.map((provider) => (
            <SelectItem key={provider.id} value={provider.id}>
              {provider.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function SubtitleLanguageSelect() {
  const { subtitleLanguage } = useAtomValue(playerPreferencesAtom)
  const updatePreferences = useAtomSet(updatePlayerPreferencesAtom)

  return (
    <Select
      value={subtitleLanguage ?? automatic}
      onValueChange={(next) =>
        updatePreferences({
          subtitleLanguage: next === automatic ? null : next,
        })
      }
    >
      <SelectTrigger className="w-40">
        <SelectValue>{subtitleLanguage ?? "Provider default"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={automatic}>Provider default</SelectItem>
          {subtitleLanguages.map((language) => (
            <SelectItem key={language} value={language}>
              {language}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function PlaybackPanel() {
  const preferences = useAtomValue(playerPreferencesAtom)
  const updatePreferences = useAtomSet(updatePlayerPreferencesAtom)

  const update = (key: PlayerPreferenceKey, checked: boolean) => {
    updatePreferences({ [key]: checked })
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingCard id="playback.viewMode" className="p-4">
        <SettingHeading
          title="Theater mode"
          description="On desktop, keep episodes and details beside the player instead of filling the screen."
          action={
            <Switch
              checked={preferences.viewMode === "theater"}
              onCheckedChange={(checked) =>
                updatePreferences({
                  viewMode: checked ? "theater" : "immersive",
                })
              }
            />
          }
        />
      </SettingCard>
      <SettingCard id="playback.audio" className="p-4">
        <SettingHeading
          title="Default audio"
          description="Pick subbed or dubbed first when an episode offers both."
          action={
            <ToggleGroup
              type="single"
              variant="outline"
              value={preferences.preferredAudio}
              onValueChange={(value) => {
                if (value === "sub" || value === "dub") {
                  updatePreferences({ preferredAudio: value })
                }
              }}
            >
              <ToggleGroupItem value="sub">Sub</ToggleGroupItem>
              <ToggleGroupItem value="dub">Dub</ToggleGroupItem>
            </ToggleGroup>
          }
        />
      </SettingCard>
      <SettingCard id="playback.provider" className="p-4">
        <SettingHeading
          title="Preferred provider"
          description="Open episodes from this provider when it has the show."
          action={<ProviderSelect />}
        />
      </SettingCard>
      <SettingCard id="playback.subtitleLanguage" className="p-4">
        <SettingHeading
          title="Subtitle language"
          description="Turn on this caption track automatically when a stream has it."
          action={<SubtitleLanguageSelect />}
        />
      </SettingCard>
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
