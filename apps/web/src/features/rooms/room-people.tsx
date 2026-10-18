import type { RoomMember, RoomState } from "@animekaiser/domain"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@animekaiser/ui/components/avatar"
import { Badge } from "@animekaiser/ui/components/badge"
import { Button } from "@animekaiser/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@animekaiser/ui/components/dropdown-menu"
import { Switch } from "@animekaiser/ui/components/switch"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomSet } from "@effect/atom-react"
import { MoreHorizontal } from "lucide-react"
import {
  removeRoomParticipantAtom,
  setRoomTasteSharingAtom,
  transferRoomHostAtom,
} from "./atoms"
import { toastRoomFailure } from "./room-host"

const playbackLabel: Partial<Record<RoomMember["playbackState"], string>> = {
  blocked: "Needs to join playback",
  buffering: "Buffering",
  error: "Can't play this source",
}

export function RoomPeople({
  roomId,
  state,
}: {
  roomId: string
  state: RoomState
}) {
  const share = useAtomSet(setRoomTasteSharingAtom, { mode: "promiseExit" })
  const members = [...state.members].sort(
    (left, right) =>
      Number(right.isHost) - Number(left.isHost) ||
      Number(right.online) - Number(left.online) ||
      left.displayName.localeCompare(right.displayName)
  )

  return (
    <div className="flex flex-col gap-4 p-4">
      <ul className="flex flex-col gap-1">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            roomId={roomId}
            member={member}
            state={state}
          />
        ))}
      </ul>
      {state.you.kind === "account" && state.status === "open" ? (
        <div className="flex items-start gap-3 rounded-2xl border p-3">
          <Switch
            id={`share-taste-${roomId}`}
            checked={state.you.shareTaste}
            onCheckedChange={(checked) =>
              void share({ payload: { roomId, share: checked } }).then(
                toastRoomFailure
              )
            }
          />
          <label
            htmlFor={`share-taste-${roomId}`}
            className="flex flex-col gap-1 text-sm"
          >
            <span className="font-medium">
              Use my library for group suggestions
            </span>
            <span className="text-xs text-muted-foreground">
              Your viewing history and ratings may inform AI suggestions sent to
              the AI provider for this room. Members never see your list, but in
              small rooms they may be able to infer your tastes from
              suggestions. Off by default.
            </span>
          </label>
        </div>
      ) : null}
    </div>
  )
}

function MemberRow({
  roomId,
  member,
  state,
}: {
  roomId: string
  member: RoomMember
  state: RoomState
}) {
  const remove = useAtomSet(removeRoomParticipantAtom, { mode: "promiseExit" })
  const transfer = useAtomSet(transferRoomHostAtom, { mode: "promiseExit" })
  const you = member.id === state.you.participantId
  const moderate =
    state.you.isHost && !you && !member.isHost && state.status === "open"
  const status = member.online
    ? (playbackLabel[member.playbackState] ?? "Here now")
    : "Away"

  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2">
      <div className="relative">
        <Avatar className="size-9">
          {member.image ? <AvatarImage src={member.image} alt="" /> : null}
          <AvatarFallback>
            {member.displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span
          aria-hidden
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-background",
            member.online ? "bg-emerald-500" : "bg-muted-foreground/40"
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          <span className="truncate">{member.displayName}</span>
          {you ? (
            <span className="text-xs font-normal text-muted-foreground">
              (you)
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {status}
          {member.kind === "guest" && member.guestExpiresAt
            ? ` · Guest until ${new Date(member.guestExpiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : ""}
        </p>
      </div>
      {member.isHost ? <Badge>Host</Badge> : null}
      {member.kind === "guest" ? <Badge variant="outline">Guest</Badge> : null}
      {moderate ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Manage ${member.displayName}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {member.kind === "account" && member.online ? (
              <DropdownMenuItem
                onSelect={() =>
                  void transfer({
                    payload: { roomId, participantId: member.id },
                  }).then(toastRoomFailure)
                }
              >
                Make host
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onSelect={() =>
                void remove({
                  payload: { roomId, participantId: member.id, ban: false },
                }).then(toastRoomFailure)
              }
            >
              Remove from room
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                void remove({
                  payload: { roomId, participantId: member.id, ban: true },
                }).then(toastRoomFailure)
              }
            >
              Remove and ban
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  )
}
