import type { StreamProviderId } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { cn } from "@animekaiser/ui/lib/utils"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { PlayCircle } from "lucide-react"
import type { ComponentProps } from "react"
import { watchTargetAtom } from "./atoms"

export function WatchNowButton({
  malId,
  provider,
  label,
  size,
  className,
}: {
  malId: number
  provider?: StreamProviderId
  label?: string
  size?: ComponentProps<typeof Button>["size"]
  className?: string
}) {
  const result = useAtomValue(watchTargetAtom({ malId, provider }))

  return Result.builder(result)
    .onInitialOrWaiting(() => (
      // Caller classNames size to content (w-fit, flex-1), which collapses an
      // empty skeleton, so the placeholder keeps its own dimensions.
      <Skeleton
        className={cn(
          "h-9 w-40 rounded-4xl bg-white/10",
          size === "sm" && "h-8 w-28"
        )}
        role="status"
        aria-label="Loading watch status"
      />
    ))
    .onFailure(() => null)
    .onSuccess((target) =>
      target === null ? null : (
        <Button asChild size={size} className={className}>
          <Link
            to="/watch/$malId/$provider/$episodeId"
            params={{
              malId: target.malId,
              provider: target.provider,
              episodeId: target.episodeId,
            }}
            search={{ audio: target.audio }}
          >
            <PlayCircle data-icon="inline-start" />
            {label ?? target.label}
          </Link>
        </Button>
      )
    )
    .render()
}
