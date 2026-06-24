import { useTheme } from "next-themes"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { PanelCard } from "./settings-shared"

const ThemeChoice = Schema.Literal("light", "dark", "system")
const decodeThemeChoiceOption = Schema.decodeUnknownOption(ThemeChoice)

export function AppearancePanel() {
  const { setTheme, theme } = useTheme()
  const selectedTheme = decodeThemeChoiceOption(theme).pipe(
    Option.getOrElse(() => "system" as const)
  )

  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">Theme</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose light mode, dark mode, or follow your system setting.
          </p>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={selectedTheme}
          onValueChange={(value) => {
            decodeThemeChoiceOption(value).pipe(Option.map(setTheme))
          }}
        >
          <ToggleGroupItem value="light">Light</ToggleGroupItem>
          <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
          <ToggleGroupItem value="system">System</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </PanelCard>
  )
}
