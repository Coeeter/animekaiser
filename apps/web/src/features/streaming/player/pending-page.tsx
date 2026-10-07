import { useSidebar } from "@animekaiser/ui/components/sidebar"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomValue } from "@effect-atom/atom-react"
import { playerPreferencesAtom } from "../preferences"
import { PlayerShell } from "./player-shell"

const miniPlayerClass =
  "group/miniplayer fixed inset-auto right-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 h-auto aspect-video w-[min(24rem,calc(100vw-1.5rem))] min-w-64 max-w-[calc(100vw-1.5rem)] touch-none cursor-move overflow-hidden rounded-xl border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:right-5 md:bottom-5 md:left-auto"

// Mirrors the loaded player's layout in both view modes, so the page doesn't
// jump when playback arrives.
export function StreamPlayerPendingPage({
  mode = "full",
}: {
  mode?: "full" | "mini"
}) {
  const { viewMode } = useAtomValue(playerPreferencesAtom)
  const { state: sidebarState } = useSidebar()
  const theater = mode === "full" && viewMode === "theater"

  if (mode === "mini") {
    return (
      <PlayerShell variant="mini" className={miniPlayerClass}>
        <VideoSkeleton />
      </PlayerShell>
    )
  }

  return (
    <PlayerShell
      variant="full"
      sidebarState={sidebarState}
      className={cn(theater && "md:flex-row md:overflow-y-auto")}
      aria-busy="true"
    >
      <div
        className={
          theater
            ? "contents md:flex md:min-w-0 md:flex-1 md:flex-col md:gap-4 md:p-4"
            : "contents"
        }
      >
        <div
          className={cn(
            "relative aspect-video w-full shrink-0 overflow-hidden bg-black",
            theater ? "md:rounded-2xl" : "md:aspect-auto md:min-h-0 md:flex-1"
          )}
        >
          <VideoSkeleton />
        </div>
        {theater ? <TheaterBarSkeleton /> : null}
      </div>
      <PanelSkeleton rail={theater} />
    </PlayerShell>
  )
}

function DarkBlock({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-white/10", className)} />
  )
}

function VideoSkeleton() {
  return (
    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-white/[0.08]">
      <div className="absolute inset-0 animate-pulse bg-white/[0.03]" />
      <div className="absolute inset-x-4 bottom-4 flex flex-col gap-3">
        <DarkBlock className="h-1 w-full rounded-full" />
        <div className="flex items-center gap-3">
          <DarkBlock className="size-8 rounded-full" />
          <DarkBlock className="size-8 rounded-full" />
          <DarkBlock className="h-3 w-24" />
          <DarkBlock className="ml-auto size-8 rounded-full" />
          <DarkBlock className="size-8 rounded-full" />
        </div>
      </div>
      <span className="sr-only">Loading stream…</span>
    </div>
  )
}

function TheaterBarSkeleton() {
  return (
    <div className="hidden flex-col gap-4 md:flex">
      <div className="flex items-center gap-2">
        {["w-20", "w-20", "w-20", "w-20"].map((width, index) => (
          <DarkBlock key={index} className={cn("h-8 rounded-full", width)} />
        ))}
        <DarkBlock className="ml-auto h-8 w-28 rounded-full" />
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <DarkBlock className="h-3 w-20" />
        <DarkBlock className="h-5 w-1/3" />
        <DarkBlock className="h-3 w-2/3" />
        <DarkBlock className="h-3 w-1/2" />
      </div>
    </div>
  )
}

function PanelSkeleton({ rail }: { rail: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 bg-background px-4 pt-4 pb-6 text-foreground",
        rail
          ? "md:sticky md:top-0 md:h-dvh md:w-96 md:shrink-0 md:overflow-hidden md:border-l"
          : "md:hidden"
      )}
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-10 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-10 rounded-full" />
        <Skeleton className="h-10 rounded-full" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-14 rounded-2xl" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-2xl border bg-card p-2.5"
          >
            <Skeleton className="aspect-video w-24 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
