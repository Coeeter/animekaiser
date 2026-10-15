import type {
  RoomAccess,
  RoomAccessChangePreview,
  RoomAiAccess,
  RoomEpisodeSelection,
  RoomPlaybackControl,
  RoomState,
} from "@animekaiser/domain"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@animekaiser/ui/components/alert-dialog"
import { Button } from "@animekaiser/ui/components/button"
import { Checkbox } from "@animekaiser/ui/components/checkbox"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@animekaiser/ui/components/dialog"
import { Input } from "@animekaiser/ui/components/input"
import { Label } from "@animekaiser/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@animekaiser/ui/components/select"
import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { useNavigate } from "@tanstack/react-router"
import * as Exit from "effect/Exit"
import { ChevronDown, Copy, Link2, Loader2, RefreshCw } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { friendsAtom } from "../social/atoms"
import {
  activeRoomIdAtom,
  closeRoomAtom,
  createRoomAtom,
  createRoomInviteLinkAtom,
  inviteToRoomAtom,
  inviteUrl,
  leaveRoomAtom,
  previewRoomAccessChangeAtom,
  revokeRoomInviteLinksAtom,
  roomAccessLabel,
  roomReactivityKeys,
  storedInviteLink,
  transferRoomHostAtom,
  updateRoomSettingsAtom,
} from "./atoms"
import { roomErrorOf, toastRoomFailure } from "./room-host"

const accessDescriptions: Record<RoomAccess, string> = {
  invite: "Only people you invite or who have your link.",
  friends: "Your friends can find and join. Links don't admit others.",
  public: "Listed for signed-in people. Guests need your link.",
}

const playbackLabels: Record<RoomPlaybackControl, string> = {
  host: "Host only",
  everyone: "Everyone",
}

const aiLabels: Record<RoomAiAccess, string> = {
  off: "Off",
  host: "Host only",
  everyone: "Everyone",
}

function ChoiceField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  description,
}: {
  id: string
  label: string
  value: T
  options: Record<T, string>
  onChange: (value: T) => void
  description?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(options) as Array<T>).map((key) => (
            <SelectItem key={key} value={key}>
              {options[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

export function CreateRoomDialog({
  open,
  onOpenChange,
  defaultName,
  selection,
  positionSeconds = 0,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName: string
  selection: RoomEpisodeSelection | null
  positionSeconds?: number
}) {
  const create = useAtomSet(createRoomAtom, { mode: "promiseExit" })
  const setActiveRoom = useAtomSet(activeRoomIdAtom)
  const navigate = useNavigate()
  const [name, setName] = useState(defaultName)
  const [access, setAccess] = useState<RoomAccess>("invite")
  const [playbackControl, setPlaybackControl] =
    useState<RoomPlaybackControl>("host")
  const [aiAccess, setAiAccess] = useState<RoomAiAccess>("host")
  const [more, setMore] = useState(false)
  const [roomId, setRoomId] = useState(() => crypto.randomUUID())
  const [creating, setCreating] = useState(false)

  const submit = async () => {
    setCreating(true)
    const exit = await create({
      payload: {
        roomId,
        name: name.trim() || defaultName,
        access,
        playbackControl,
        aiAccess,
        selection: selection ? { ...selection, positionSeconds } : null,
      },
      reactivityKeys: [roomReactivityKeys.lists],
    })
    setCreating(false)
    if (Exit.isFailure(exit)) return toastRoomFailure(exit)
    setRoomId(crypto.randomUUID())
    onOpenChange(false)
    setActiveRoom(exit.value.roomId)
    void navigate({
      to: "/rooms/$roomId",
      params: { roomId: exit.value.roomId },
      search: { invite: true },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Watch together</DialogTitle>
          <DialogDescription>
            {selection
              ? "Start a room paused on this episode. You'll start playback when everyone's ready."
              : "Open a room and choose what to watch together."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="room-name">Room name</Label>
            <Input
              id="room-name"
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </div>
          <ChoiceField
            id="room-access"
            label="Who can join"
            value={access}
            options={roomAccessLabel}
            onChange={setAccess}
            description={accessDescriptions[access]}
          />
          <button
            type="button"
            className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
            aria-expanded={more}
            onClick={() => setMore((value) => !value)}
          >
            More settings
            <ChevronDown
              className={more ? "size-4 rotate-180" : "size-4"}
              aria-hidden
            />
          </button>
          {more ? (
            <>
              <ChoiceField
                id="room-playback"
                label="Playback controls"
                value={playbackControl}
                options={playbackLabels}
                onChange={setPlaybackControl}
                description="You always choose the anime, episode, and audio."
              />
              <ChoiceField
                id="room-ai"
                label="Ask AI in the room"
                value={aiAccess}
                options={aiLabels}
                onChange={setAiAccess}
              />
            </>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Room chat is saved and readable by everyone admitted, including
            people who join later.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button disabled={creating} onClick={() => void submit()}>
            {creating ? <Loader2 className="animate-spin" /> : null}
            Create room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function InviteDialog({
  open,
  onOpenChange,
  state,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: RoomState
}) {
  const roomId = state.id
  const friends = useAtomValue(friendsAtom)
  const invite = useAtomSet(inviteToRoomAtom, { mode: "promiseExit" })
  const createLink = useAtomSet(createRoomInviteLinkAtom, {
    mode: "promiseExit",
  })
  const revokeLinks = useAtomSet(revokeRoomInviteLinksAtom, {
    mode: "promiseExit",
  })
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState(() => storedInviteLink.read(roomId))
  const memberNames = new Set(
    state.members.map((member) => member.displayName.toLowerCase())
  )

  const ensureLink = async (replace: boolean) => {
    if (link && !replace) return link
    if (replace) {
      const revoked = await revokeLinks({ payload: { roomId } })
      if (Exit.isFailure(revoked)) {
        toastRoomFailure(revoked)
        return null
      }
      storedInviteLink.clear(roomId)
    }
    const exit = await createLink({ payload: { roomId } })
    if (Exit.isFailure(exit)) {
      toastRoomFailure(exit)
      return null
    }
    storedInviteLink.write(roomId, exit.value)
    setLink(exit.value)
    return exit.value
  }

  const copyLink = async (replace = false) => {
    setBusy(true)
    const value = await ensureLink(replace)
    setBusy(false)
    if (!value) return
    const url = inviteUrl(roomId, value.token)
    try {
      await navigator.clipboard.writeText(url)
      toast.success(replace ? "New invite link copied" : "Invite link copied", {
        description: "Links expire after 7 days.",
      })
    } catch {
      toast.message("Copy this invite link", { description: url })
    }
  }

  const sendInvites = async () => {
    setBusy(true)
    const exit = await invite({
      payload: { roomId, userIds: [...chosen] },
    })
    setBusy(false)
    if (Exit.isFailure(exit)) return toastRoomFailure(exit)
    toast.success(
      chosen.size === 1 ? "Invitation sent" : `${chosen.size} invitations sent`
    )
    setChosen(new Set())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>
            Invite friends directly, or share a link.{" "}
            {state.access === "friends"
              ? "This room is friends only, so links admit only your friends."
              : "Anyone with the link can join, including guests without an account."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void copyLink()}>
              <Copy data-icon="inline-start" />
              Copy invite link
            </Button>
            {link ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void copyLink(true)}
              >
                <RefreshCw data-icon="inline-start" />
                Replace link
              </Button>
            ) : null}
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void revokeLinks({ payload: { roomId } }).then((exit) => {
                  if (Exit.isFailure(exit)) return toastRoomFailure(exit)
                  storedInviteLink.clear(roomId)
                  setLink(null)
                  toast.success("Invite links revoked")
                })
              }
            >
              <Link2 data-icon="inline-start" />
              Revoke links
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Friends</p>
            {Result.builder(friends)
              .onInitialOrWaiting(() => (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ))
              .onFailure(() => (
                <p className="text-sm text-muted-foreground">
                  Friends couldn't be loaded.
                </p>
              ))
              .onSuccess((value) =>
                value.friends.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Add friends to invite them directly.
                  </p>
                ) : (
                  <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
                    {value.friends.map((friend) => {
                      const here = memberNames.has(
                        friend.displayName.toLowerCase()
                      )
                      const id = `invite-${friend.id}`
                      return (
                        <li
                          key={friend.id}
                          className="flex items-center gap-3 rounded-xl px-2 py-1.5"
                        >
                          <Checkbox
                            id={id}
                            disabled={here}
                            checked={chosen.has(friend.id)}
                            onCheckedChange={(checked) =>
                              setChosen((current) => {
                                const next = new Set(current)
                                if (checked) next.add(friend.id)
                                else next.delete(friend.id)
                                return next
                              })
                            }
                          />
                          <label htmlFor={id} className="flex-1 text-sm">
                            {friend.displayName}
                            {here ? (
                              <span className="text-muted-foreground">
                                {" "}
                                · in room
                              </span>
                            ) : null}
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )
              )
              .render()}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            disabled={busy || chosen.size === 0}
            onClick={() => void sendInvites()}
          >
            Send invitations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RoomSettingsDialog({
  open,
  onOpenChange,
  state,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: RoomState
}) {
  const update = useAtomSet(updateRoomSettingsAtom, { mode: "promiseExit" })
  const preview = useAtomSet(previewRoomAccessChangeAtom, {
    mode: "promiseExit",
  })
  const [name, setName] = useState(state.name)
  const [access, setAccess] = useState(state.access)
  const [playbackControl, setPlaybackControl] = useState(state.playbackControl)
  const [aiAccess, setAiAccess] = useState(state.aiAccess)
  const [confirm, setConfirm] = useState<RoomAccessChangePreview | null>(null)
  const [saving, setSaving] = useState(false)

  const apply = async () => {
    setSaving(true)
    const exit = await update({
      payload: {
        roomId: state.id,
        name: name.trim() || state.name,
        access,
        playbackControl,
        aiAccess,
      },
      reactivityKeys: [roomReactivityKeys.lists],
    })
    setSaving(false)
    setConfirm(null)
    if (Exit.isFailure(exit)) return toastRoomFailure(exit)
    onOpenChange(false)
  }

  const save = async () => {
    if (access === state.access) return apply()
    const exit = await preview({ payload: { roomId: state.id, access } })
    if (Exit.isFailure(exit)) return toastRoomFailure(exit)
    if (exit.value.removed.length === 0 && !exit.value.broadens) return apply()
    setConfirm(exit.value)
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) {
            setName(state.name)
            setAccess(state.access)
            setPlaybackControl(state.playbackControl)
            setAiAccess(state.aiAccess)
          }
          onOpenChange(next)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Room settings</DialogTitle>
            <DialogDescription>
              Changes apply to everyone immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room-settings-name">Room name</Label>
              <Input
                id="room-settings-name"
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </div>
            <ChoiceField
              id="room-settings-access"
              label="Who can join"
              value={access}
              options={roomAccessLabel}
              onChange={setAccess}
              description={accessDescriptions[access]}
            />
            <ChoiceField
              id="room-settings-playback"
              label="Playback controls"
              value={playbackControl}
              options={playbackLabels}
              onChange={setPlaybackControl}
              description="Everyone includes guests. You always choose the anime, episode, and audio."
            />
            <ChoiceField
              id="room-settings-ai"
              label="Ask AI in the room"
              value={aiAccess}
              options={aiLabels}
              onChange={setAiAccess}
              description="Turning AI off cancels room requests in progress. Members' private AI is unaffected."
            />
          </DialogBody>
          <DialogFooter>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(next) => {
          if (!next) setConfirm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change access to {roomAccessLabel[access]}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2">
                {confirm && confirm.removed.length > 0 ? (
                  <p>
                    These people will lose access:{" "}
                    <span className="font-medium text-foreground">
                      {confirm.removed.map((entry) => entry.name).join(", ")}
                    </span>
                    .
                  </p>
                ) : null}
                {confirm?.broadens ? (
                  <p>
                    More people will be able to join, and anyone newly admitted
                    can read the saved room chat, including shared AI messages.
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void apply()}>
              Change access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function LeaveRoomDialog({
  open,
  onOpenChange,
  state,
  onClose,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: RoomState
  onClose: () => void
}) {
  const leave = useAtomSet(leaveRoomAtom, { mode: "promiseExit" })
  const transfer = useAtomSet(transferRoomHostAtom, { mode: "promiseExit" })
  const setActiveRoom = useAtomSet(activeRoomIdAtom)
  const navigate = useNavigate()
  const hostLeaving = state.you.isHost && state.status === "open"
  const candidates = state.members.filter(
    (member) => !member.isHost && member.kind === "account" && member.online
  )
  const [nextHost, setNextHost] = useState<string>("")

  const leaveNow = async () => {
    if (hostLeaving) {
      if (!nextHost) return
      const moved = await transfer({
        payload: { roomId: state.id, participantId: nextHost },
      })
      if (Exit.isFailure(moved)) return toastRoomFailure(moved)
    }
    const exit = await leave({
      payload: { roomId: state.id },
      reactivityKeys: [roomReactivityKeys.lists],
    })
    if (Exit.isFailure(exit) && roomErrorOf(exit)?.reason !== "not_member")
      return toastRoomFailure(exit)
    onOpenChange(false)
    setActiveRoom(null)
    void navigate({ to: "/rooms" })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave {state.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {hostLeaving
              ? "Hand hosting to someone here now, or close the room for everyone."
              : "You can rejoin later if you're still invited or the room allows it."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {hostLeaving ? (
          candidates.length > 0 ? (
            <Select value={nextHost} onValueChange={setNextHost}>
              <SelectTrigger aria-label="New host" className="w-full">
                <SelectValue placeholder="Choose the new host" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nobody signed in is here to take over hosting.
            </p>
          )
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
          {hostLeaving ? (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                onClose()
              }}
            >
              Close room
            </Button>
          ) : null}
          <AlertDialogAction
            disabled={hostLeaving && !nextHost}
            onClick={(event) => {
              event.preventDefault()
              void leaveNow()
            }}
          >
            {hostLeaving ? "Transfer and leave" : "Leave room"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function CloseRoomDialog({
  mode,
  onOpenChange,
  state,
}: {
  mode: "close" | "delete" | null
  onOpenChange: (open: boolean) => void
  state: RoomState
}) {
  const close = useAtomSet(closeRoomAtom, { mode: "promiseExit" })
  const setActiveRoom = useAtomSet(activeRoomIdAtom)
  const navigate = useNavigate()

  const confirm = async () => {
    const exit = await close({
      payload: { roomId: state.id, delete: mode === "delete" },
      reactivityKeys: [roomReactivityKeys.lists],
    })
    if (Exit.isFailure(exit)) return toastRoomFailure(exit)
    onOpenChange(false)
    if (mode === "delete") {
      setActiveRoom(null)
      void navigate({ to: "/rooms" })
    }
  }

  return (
    <AlertDialog open={mode !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === "delete" ? "Delete this room?" : "Close this room?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {mode === "delete"
              ? "Playback stops and the room's chat, picks, and history are deleted for everyone now."
              : "Playback and new joins stop for everyone. Members can still read the chat for 30 days."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void confirm()}
            className={
              mode === "delete"
                ? "bg-destructive text-white hover:bg-destructive/90"
                : undefined
            }
          >
            {mode === "delete" ? "Delete room" : "Close room"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
