import {
  ToggleGroup,
  ToggleGroupItem,
} from "@animekaiser/ui/components/toggle-group"
import { useAtom } from "@effect/atom-react"
import { animeTitlePreferenceAtom } from "../anime/common/title"
import { SettingCard, SettingHeading } from "./settings-shared"

export function GeneralPanel() {
  const [title, setTitle] = useAtom(animeTitlePreferenceAtom)
  const titleAction = (
    <ToggleGroup
      type="single"
      variant="outline"
      spacing={0}
      value={title}
      onValueChange={(value) => {
        if (value === "english" || value === "romaji") {
          setTitle(value)
        }
      }}
    >
      <ToggleGroupItem value="romaji">Romaji</ToggleGroupItem>
      <ToggleGroupItem value="english">English</ToggleGroupItem>
    </ToggleGroup>
  )
  return (
    <div className="flex flex-col gap-4">
      <SettingCard id="general.titleLanguage">
        <SettingHeading
          title="Anime title language"
          description="Choose your preferred title when both are available."
          action={titleAction}
        />
      </SettingCard>
    </div>
  )
}
