import { Button } from "@animekaiser/ui/components/button"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Link, useRouter } from "@tanstack/react-router"
import * as Exit from "effect/Exit"
import { Users } from "lucide-react"
import { activeRoomIdAtom, leaveRoomAtom, roomLiveAtom } from "./atoms"
import { liveOf, roomErrorOf, toastRoomFailure } from "./room-host"

// Solo playback would compete with the room's player, so watching alone
// requires leaving the room first.
export function LeaveRoomForSolo({ roomId }: { roomId: string }) {
  const live = liveOf(useAtomValue(roomLiveAtom(roomId)))
  const leave = useAtomSet(leaveRoomAtom, { mode: "promiseExit" })
  const setActiveRoom = useAtomSet(activeRoomIdAtom)
  const router = useRouter()
  const isHost = live?.state?.you.isHost ?? false

  const leaveAndWatch = async () => {
    const exit = await leave({ payload: { roomId } })
    if (Exit.isFailure(exit) && roomErrorOf(exit)?.reason !== "not_member")
      return toastRoomFailure(exit)
    setActiveRoom(null)
    void router.invalidate()
  }

  return (
    <div className="mx-auto flex min-h-[70svh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Users className="size-10 text-muted-foreground" />
      <h1 className="font-heading text-xl font-semibold">
        You're in {live?.state?.name ?? "a room"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {isHost
          ? "Hand hosting to someone or close the room before watching alone."
          : "Leave the room to watch this on your own."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/rooms/$roomId" params={{ roomId }}>
            Return to room
          </Link>
        </Button>
        {isHost ? null : (
          <Button variant="outline" onClick={() => void leaveAndWatch()}>
            Leave room and watch
          </Button>
        )}
      </div>
    </div>
  )
}
