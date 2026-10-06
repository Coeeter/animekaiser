import { cn } from "@animekaiser/ui/lib/utils"

export function EpisodeThumbnail({
  image,
  number,
  progress,
  highlighted = false,
  blur = false,
  className,
}: {
  blur?: boolean
  image: string | null
  number: number
  progress?: number
  highlighted?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative aspect-video shrink-0 overflow-hidden rounded-lg border bg-muted",
        highlighted && "border-primary ring-1 ring-primary/40",
        className
      )}
    >
      <span
        className={cn(
          "absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums text-muted-foreground",
          highlighted && "text-foreground"
        )}
      >
        {number}
      </span>
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={cn(
            "absolute inset-0 size-full object-cover",
            blur && "scale-110 blur-md"
          )}
          onError={(event) => {
            event.currentTarget.hidden = true
          }}
        />
      ) : null}
      {image ? (
        <span
          className={cn(
            "absolute bottom-1 left-1 rounded-md bg-background/85 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums backdrop-blur-sm",
            highlighted && "bg-primary text-primary-foreground"
          )}
        >
          EP {number}
        </span>
      ) : null}
      {progress !== undefined && progress > 0 ? (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-background/60">
          <span
            className="block h-full bg-primary"
            style={{ width: `${progress}%` }}
          />
        </span>
      ) : null}
    </div>
  )
}
