import { Button } from "@animekaiser/ui/components/button"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { UserRound, Users } from "lucide-react"
import { friendsAtom } from "../social/atoms"
import { activeRoomIdAtom, roomListAtom } from "./atoms"

// A compact line under Continue watching; it renders nothing unless there is
// something to act on, so it never competes with the hero.
export function HomeRoomsStrip() {
  const activeRoomId = useAtomValue(activeRoomIdAtom)
  const mine = Result.getOrElse(useAtomValue(roomListAtom("mine")), () => [])
  const invitations = Result.getOrElse(
    useAtomValue(roomListAtom("invitations")),
    () => []
  )
  const requests = Result.getOrElse(useAtomValue(friendsAtom), () => null)
    ?.incoming.length
  const active = mine.find((room) => room.id === activeRoomId)
  if (!active && invitations.length === 0 && !requests) return null

  return (
    <section
      aria-label="Rooms and invitations"
      className="flex flex-wrap items-center gap-2 rounded-3xl border bg-card/60 px-4 py-3 text-sm"
    >
      {active ? (
        <Button asChild size="sm">
          <Link to="/rooms/$roomId" params={{ roomId: active.id }}>
            <Users data-icon="inline-start" />
            Return to {active.name}
          </Link>
        </Button>
      ) : null}
      {invitations.length > 0 ? (
        <Button asChild size="sm" variant="outline">
          <Link to="/rooms">
            {invitations.length === 1
              ? `Invitation to ${invitations[0]?.name}`
              : `${invitations.length} room invitations`}
          </Link>
        </Button>
      ) : null}
      {requests ? (
        <Button asChild size="sm" variant="outline">
          <Link to="/friends">
            <UserRound data-icon="inline-start" />
            {requests === 1
              ? "1 friend request"
              : `${requests} friend requests`}
          </Link>
        </Button>
      ) : null}
    </section>
  )
}
