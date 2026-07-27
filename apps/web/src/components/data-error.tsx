import { Button } from "@animekaiser/ui/components/button"
import { AlertCircle } from "lucide-react"

export function DataError({
  title = "Unable to load this section",
  description = "Check your connection and try again.",
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center"
    >
      <AlertCircle className="size-6 text-destructive" />

      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
