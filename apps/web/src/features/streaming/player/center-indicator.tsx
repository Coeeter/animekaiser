import { cn } from "@animekaiser/ui/lib/utils"
import { Loader2, Pause, Play } from "lucide-react"

export type CenterIndicatorIcon = "loading" | "play" | "pause"

export function PlayerCenterIndicator({
  icon,
  visible,
}: {
  icon: CenterIndicatorIcon
  visible: boolean
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 z-10 hidden size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white shadow-2xl ring-1 ring-white/15 backdrop-blur-md transition-opacity duration-200 md:grid md:size-24 [&_svg]:size-9 md:[&_svg]:size-11",
        !visible && "opacity-0"
      )}
    >
      {icon === "loading" ? (
        <Loader2 className="animate-spin" />
      ) : icon === "play" ? (
        <Play />
      ) : (
        <Pause />
      )}
    </div>
  )
}
