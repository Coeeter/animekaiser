import { Button } from "@animekaiser/ui/components/button"
import { Loader2, MonitorPlay, Play, UserRoundX } from "lucide-react"
import type { RoomPlayerController } from "./room-player"

export function RoomPlayerOverlay({
  room,
  blocked,
  onJoinPlayback,
}: {
  room: RoomPlayerController
  blocked: boolean
  onJoinPlayback: () => void
}) {
  return (
    <>
      {!room.connected ? (
        <div
          role="status"
          className="absolute top-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur"
        >
          <Loader2 className="size-3.5 animate-spin" />
          Reconnecting to the room…
        </div>
      ) : room.hostReconnecting && !room.isHost ? (
        <div
          role="status"
          className="absolute top-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur"
        >
          <Loader2 className="size-3.5 animate-spin" />
          Host reconnecting…
        </div>
      ) : room.hostAway && !room.isHost ? (
        <div
          role="status"
          className="absolute top-3 left-1/2 z-40 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur"
        >
          <UserRoundX className="size-3.5 shrink-0" />
          Host is away. Playback waits for them — keep chatting or leave.
        </div>
      ) : null}

      {room.connected && !room.controller ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/80 p-4 text-center text-white">
          <div className="flex max-w-xs flex-col items-center gap-3">
            <MonitorPlay className="size-8 text-white/70" />
            <p className="text-sm">
              This room is playing in another tab or window.
            </p>
            <Button onClick={room.claimPlayback}>Play here instead</Button>
          </div>
        </div>
      ) : blocked ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/60 p-4 text-white">
          <Button size="lg" onClick={onJoinPlayback}>
            <Play data-icon="inline-start" />
            Join playback
          </Button>
        </div>
      ) : null}
    </>
  )
}
