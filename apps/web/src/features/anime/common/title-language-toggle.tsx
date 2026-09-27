import { Button } from "@animekaiser/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@animekaiser/ui/components/tooltip"
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
