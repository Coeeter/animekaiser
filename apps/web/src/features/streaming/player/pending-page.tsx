import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { Loader2 } from "lucide-react"
import { PlayerShell } from "./player-shell"

const miniPlayerClass =
  "group/miniplayer fixed inset-auto right-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 h-auto aspect-video w-[min(24rem,calc(100vw-1.5rem))] min-w-64 max-w-[calc(100vw-1.5rem)] touch-none cursor-move overflow-hidden rounded-xl border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:right-5 md:bottom-5 md:left-auto"

export function StreamPlayerPendingPage({
  mode = "full",
}: {
  mode?: "full" | "mini"
}) {
  return (
    <PlayerShell
      variant={mode}
      className={mode === "mini" ? miniPlayerClass : undefined}
    >
      <div className="relative aspect-video w-full shrink-0 md:aspect-auto md:min-h-0 md:flex-1">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/5">
          <Loader2 className="size-6 animate-spin text-white/70" />
          <p className="text-sm text-white/70">Loading stream…</p>
        </div>
      </div>
      {mode === "full" ? (
        <div className="flex flex-col gap-4 bg-background p-4 md:hidden">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-11 rounded-2xl" />
            <Skeleton className="h-11 rounded-2xl" />
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : null}
    </PlayerShell>
  )
}
