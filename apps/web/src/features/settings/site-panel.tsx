import { useAtom } from "@effect-atom/atom-react"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { animeTitlePreferenceAtom } from "../anime/common/title"
import { PanelCard } from "./settings-shared"

export function SitePanel() {
  const [title, setTitle] = useAtom(animeTitlePreferenceAtom)

  const update = (value: "english" | "romaji") => {
    setTitle(value)
    window.localStorage.setItem("anime-title-preference", value)
  }

  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">Anime title language</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose your preferred title when both are available.
          </p>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={title}
          onValueChange={(value) => {
            if (value === "english" || value === "romaji") update(value)
          }}
        >
          <ToggleGroupItem value="romaji">Romaji</ToggleGroupItem>
          <ToggleGroupItem value="english">English</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </PanelCard>
  )
}
