import type { StreamProviderId } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomValue } from "@effect/atom-react"
import { Loader2, Play, RotateCcw } from "lucide-react"
import { providerLabelAtom } from "../atoms"
import type { SourceChoice } from "../sources"

export function SourceFailurePanel({
  provider,
  episodeNumber,
  recovering,
  suggestion,
  exhausted,
  onAccept,
  onRetry,
  className,
}: {
  provider: StreamProviderId
  episodeNumber: number | null
  recovering: boolean
  suggestion: SourceChoice | null
  exhausted: boolean
  onAccept: () => void
  onRetry: () => void
  className?: string
}) {
  const providerName = useAtomValue(providerLabelAtom(provider))

  return (
    <div
      role="alert"
      className={cn(
        "flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/10 bg-black/80 p-5 text-white shadow-2xl backdrop-blur-md",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="font-heading text-base font-semibold">
          {providerName} couldn't play{" "}
          {episodeNumber === null ? "this episode" : `Episode ${episodeNumber}`}
        </p>
        <p className="text-sm text-white/65">
          {recovering ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              Looking for another provider…
            </span>
          ) : suggestion ? (
            "Another provider has this episode."
          ) : exhausted ? (
            "No other provider could play this episode and audio."
          ) : (
            "The provider may be down right now."
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestion ? (
          <SuggestionButton suggestion={suggestion} onAccept={onAccept} />
        ) : null}
        <Button variant="outline" onClick={onRetry}>
          <RotateCcw data-icon="inline-start" />
          Try again
        </Button>
      </div>
    </div>
  )
}

function SuggestionButton({
  suggestion,
  onAccept,
}: {
  suggestion: SourceChoice
  onAccept: () => void
}) {
  const label = useAtomValue(providerLabelAtom(suggestion.provider))
  return (
    <Button onClick={onAccept}>
      <Play data-icon="inline-start" />
      Play on {label}
    </Button>
  )
}
