import {
  ToggleGroup,
  ToggleGroupItem,
} from "@animekaiser/ui/components/toggle-group"
import { useAtom } from "@effect-atom/atom-react"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { useTheme } from "next-themes"
import { animeTitlePreferenceAtom } from "../anime/common/title"
import { SettingCard, SettingHeading } from "./settings-shared"

const ThemeChoice = Schema.Literal("light", "dark", "system")
const decodeThemeChoiceOption = Schema.decodeUnknownOption(ThemeChoice)

export function AppearancePanel() {
  const { setTheme, theme } = useTheme()
  const selectedTheme = decodeThemeChoiceOption(theme).pipe(
    Option.getOrElse(() => "system" as const)
  )
  const [title, setTitle] = useAtom(animeTitlePreferenceAtom)
  const themeAction = (
    <ToggleGroup
      type="single"
      variant="outline"
      spacing={0}
      value={selectedTheme}
      onValueChange={(value) =>
        decodeThemeChoiceOption(value).pipe(Option.map(setTheme))
      }
    >
      <ToggleGroupItem value="light">Light</ToggleGroupItem>
      <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
      <ToggleGroupItem value="system">System</ToggleGroupItem>
    </ToggleGroup>
  )
  const titleAction = (
    <ToggleGroup
      type="single"
      variant="outline"
      spacing={0}
      value={title}
      onValueChange={(value) => {
        if (value === "english" || value === "romaji") {
          setTitle(value)
          window.localStorage.setItem("anime-title-preference", value)
        }
      }}
    >
      <ToggleGroupItem value="romaji">Romaji</ToggleGroupItem>
      <ToggleGroupItem value="english">English</ToggleGroupItem>
    </ToggleGroup>
  )
  return (
    <div className="flex flex-col gap-4">
      <SettingCard id="appearance.theme">
        <SettingHeading
          title="Theme"
          description="Choose light mode, dark mode, or follow your system setting."
          action={themeAction}
        />
      </SettingCard>
      <SettingCard id="appearance.titleLanguage">
        <SettingHeading
          title="Anime title language"
          description="Choose your preferred title when both are available."
          action={titleAction}
        />
      </SettingCard>
    </div>
  )
}
