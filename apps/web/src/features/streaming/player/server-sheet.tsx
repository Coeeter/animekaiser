import type { StreamPlayback } from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@animekaiser/ui/components/sheet"
import { cn } from "@animekaiser/ui/lib/utils"
import { Link } from "@tanstack/react-router"
import { Check, Server } from "lucide-react"
import { audioLabel } from "../player-format"

export function ServerSheet({
  open,
  onOpenChange,
  portalContainer,
  playback,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  portalContainer: HTMLElement | null
  playback: StreamPlayback
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[min(92vw,26rem)] bg-background"
        portalContainer={portalContainer}
        side="right"
      >
        <SheetHeader>
          <SheetTitle>Stream server</SheetTitle>
          <SheetDescription>
            Choose another server if playback is slow or unavailable.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-2">
          {playback.servers.map((server) => {
            const selected = server.id === playback.server.id
            return (
              <Link
                key={server.id}
                to="/watch/$malId/$provider/$episodeId"
                params={{
                  malId: playback.anime.malId,
                  provider: playback.provider,
                  episodeId: playback.episode.id,
                }}
                search={{
                  audio: playback.audio,
                  serverId: server.isDefault ? undefined : server.id,
                }}
                replace
                className={cn(
                  "flex min-h-16 items-center gap-3 rounded-xl border bg-card/70 p-3 transition hover:border-primary/40 hover:bg-accent/60",
                  selected && "border-primary/60 bg-accent"
                )}
                onClick={() => onOpenChange(false)}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl border bg-background",
                    selected &&
                      "border-primary bg-primary text-primary-foreground"
                  )}
                >
                  <Server className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-sm font-medium"
                    title={server.name}
                  >
                    {server.name}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {audioLabel(server.audio)} audio
                  </span>
                </span>
                {selected ? (
                  <Badge>
                    <Check data-icon="inline-start" /> Current
                  </Badge>
                ) : null}
              </Link>
            )
          })}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
