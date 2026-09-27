import { Button } from "@animekaiser/ui/components/button"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@animekaiser/ui/components/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@animekaiser/ui/components/tooltip"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtom } from "@effect-atom/atom-react"
import { setAnimeTitlePreferenceAtom } from "./title"

export function TitleLanguageToggle({ className }: { className?: string }) {
  const [preference, setPreference] = useAtom(setAnimeTitlePreferenceAtom)
  const next = preference === "english" ? "romaji" : "english"
  const label =
    next === "english" ? "Show English titles" : "Show romaji titles"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          className={className}
          onClick={() => setPreference(next)}
        >
          <span className="text-[11px] font-semibold tracking-wide">
            {preference === "english" ? "EN" : "JP"}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function TitleLanguageSwitch({ className }: { className?: string }) {
  const [preference, setPreference] = useAtom(setAnimeTitlePreferenceAtom)

  return (
    <div
      className={cn("flex items-center justify-between gap-2 px-2", className)}
    >
      <span className="text-xs text-sidebar-foreground/70">Titles</span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={preference}
        onValueChange={(value) => {
          if (value === "english" || value === "romaji") setPreference(value)
        }}
      >
        <ToggleGroupItem value="english" className="px-2.5 text-xs">
          EN
        </ToggleGroupItem>
        <ToggleGroupItem value="romaji" className="px-2.5 text-xs">
          JP
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
