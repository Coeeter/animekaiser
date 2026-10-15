import type { RoomAdmission } from "@animekaiser/domain"
import { GuestDisplayName } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { Input } from "@animekaiser/ui/components/input"
import { Label } from "@animekaiser/ui/components/label"
import {
  Result,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link, useNavigate } from "@tanstack/react-router"
import * as Exit from "effect/Exit"
import * as Schema from "effect/Schema"
import { Loader2, Search, Sparkles, Users } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { DataError } from "../../components/data-error"
import { apiUrl, navigateAfterAuthChange } from "../../services/api-clients"
import { AnimeTitle } from "../anime/common/anime-title"
import { sessionAtom } from "../auth/atoms"
import {
  activeRoomIdAtom,
  endedRoomsAtom,
  joinRoomAtom,
  roomAccessLabel,
  roomAdmissionAtom,
  roomEndMessage,
  roomLiveAtom,
  roomReactivityKeys,
} from "./atoms"
import { InviteDialog } from "./room-dialogs"
import { liveOf, toastRoomFailure } from "./room-host"
import { RoomPanel } from "./room-panel"
import { useAddToRoom } from "./room-picks"

const readInviteToken = (roomId: string) => {
  const key = `kaiser.pendingInvite.${roomId}`
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const fromHash = hash.get("invite")
  if (fromHash) {
    try {
      window.sessionStorage.setItem(key, fromHash)
    } catch {}
    // The token must not linger in history, screenshots, or referrers.
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search
    )
    return fromHash
  }
  try {
    return window.sessionStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

const clearInviteToken = (roomId: string) => {
  try {
    window.sessionStorage.removeItem(`kaiser.pendingInvite.${roomId}`)
  } catch {}
}

export function RoomPage({
  roomId,
  openInvite,
}: {
  roomId: string
  openInvite: boolean
}) {
  const [inviteToken] = useState(() => readInviteToken(roomId))
  const activeRoom = useAtomValue(activeRoomIdAtom)
  const endedMessage = useAtomValue(endedRoomsAtom).get(roomId)

  if (activeRoom === roomId)
    return <JoinedRoom roomId={roomId} openInvite={openInvite} />
  if (endedMessage) return <EndedRoom roomId={roomId} message={endedMessage} />
  return <AdmissionLoader roomId={roomId} inviteToken={inviteToken} />
}

function EndedRoom({ roomId, message }: { roomId: string; message: string }) {
  const setEndedRooms = useAtomSet(endedRoomsAtom)
  const refreshLive = useAtomRefresh(roomLiveAtom(roomId))
  return (
    <RoomUnavailable message={message}>
      <Button
        variant="ghost"
        onClick={() => {
          refreshLive()
          setEndedRooms((current) => {
            const next = new Map(current)
            next.delete(roomId)
            return next
          })
        }}
      >
        Check again
      </Button>
    </RoomUnavailable>
  )
}

function AdmissionLoader({
  roomId,
  inviteToken,
}: {
  roomId: string
  inviteToken: string | undefined
}) {
  const admission = useAtomValue(roomAdmissionAtom({ roomId, inviteToken }))
  const refresh = useAtomRefresh(roomAdmissionAtom({ roomId, inviteToken }))

  return Result.builder(admission)
    .onInitialOrWaiting(() => <RoomPending />)
    .onFailure(() => (
      <div className="mx-auto w-full max-w-xl p-4 md:p-8">
        <DataError title="Unable to open this room" onRetry={refresh} />
      </div>
    ))
    .onSuccess((value) => (
      <Admission roomId={roomId} admission={value} inviteToken={inviteToken} />
    ))
    .render()
}

function RoomPending() {
  return (
    <div className="grid min-h-[60svh] place-items-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function JoinedRoom({
  roomId,
  openInvite,
}: {
  roomId: string
  openInvite: boolean
}) {
  const live = liveOf(useAtomValue(roomLiveAtom(roomId)))
  const addToRoom = useAddToRoom(roomId)
  const navigate = useNavigate()
  const [inviteOpen, setInviteOpen] = useState(openInvite)

  useEffect(() => {
    clearInviteToken(roomId)
  }, [roomId])

  if (!live?.state) return <RoomPending />
  const state = live.state
  if (live.ended || live.failure)
    return (
      <RoomUnavailable
        message={
          live.ended
            ? roomEndMessage[live.ended]
            : (live.failure?.message ?? "This room is unavailable.")
        }
      />
    )

  // While an episode is selected the persistent player renders the room,
  // including this panel, so the page itself stays empty.
  if (state.selection && state.status === "open") {
    return (
      <>
        <title>{`${state.name} | AnimeKaiser`}</title>
        {state.you.isHost ? (
          <InviteDialog
            open={inviteOpen}
            onOpenChange={(open) => {
              setInviteOpen(open)
              if (!open)
                void navigate({
                  to: "/rooms/$roomId",
                  params: { roomId },
                  search: {},
                  replace: true,
                })
            }}
            state={state}
          />
        ) : null}
      </>
    )
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] w-full max-w-6xl flex-col gap-4 p-0 md:h-dvh md:flex-row md:p-6">
      <title>{`${state.name} | AnimeKaiser`}</title>
      {state.status === "open" ? (
        <section className="flex flex-col items-center justify-center gap-4 border-b px-4 py-8 text-center md:flex-1 md:rounded-3xl md:border">
          <Users className="size-10 text-muted-foreground" />
          <div className="flex max-w-sm flex-col gap-1.5">
            <h1 className="font-heading text-2xl font-semibold">
              What are we watching?
            </h1>
            <p className="text-sm text-muted-foreground">
              Anyone can suggest and vote in Picks.{" "}
              {state.you.isHost
                ? "You choose the episode and start playback."
                : "The host picks the episode and starts playback."}
            </p>
          </div>
          <div className="grid w-full max-w-sm grid-cols-1 gap-2 sm:grid-cols-2">
            <Button size="lg" onClick={addToRoom}>
              <Search data-icon="inline-start" />
              Search anime
            </Button>
            {state.aiAccess === "off" ? null : (
              <Button
                size="lg"
                variant="outline"
                disabled={!state.you.canAskAi}
                title={
                  state.you.canAskAi
                    ? undefined
                    : "The host hasn't allowed you to ask AI here."
                }
                onClick={() =>
                  void navigate({
                    to: "/rooms/$roomId",
                    params: { roomId },
                    search: { ai: true },
                  })
                }
              >
                <Sparkles data-icon="inline-start" />
                Ask AI
              </Button>
            )}
          </div>
        </section>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col md:max-w-md md:overflow-hidden md:rounded-3xl md:border">
        <RoomPanel roomId={roomId} variant="page" />
      </div>
      {state.you.isHost ? (
        <InviteDialog
          open={inviteOpen}
          onOpenChange={(open) => {
            setInviteOpen(open)
            if (!open)
              void navigate({
                to: "/rooms/$roomId",
                params: { roomId },
                search: {},
                replace: true,
              })
          }}
          state={state}
        />
      ) : null}
    </div>
  )
}

function RoomUnavailable({
  message,
  children,
}: {
  message: string
  children?: ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-[60svh] w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Users className="size-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link to="/rooms">Back to rooms</Link>
        </Button>
        {children}
      </div>
    </div>
  )
}

const statusCopy: Record<RoomAdmission["status"], string> = {
  member: "",
  joinable: "",
  sign_in_required: "Sign in to join this room.",
  invite_required: "This room needs an invitation. Ask the host for a link.",
  friends_only: "Only the host's friends can join this room.",
  full: "This room is full right now. Try again when someone leaves.",
  banned: "You can't join this room.",
  closed: "This room has closed.",
  unavailable: "This room doesn't exist or isn't available to you.",
}

function Admission({
  roomId,
  admission,
  inviteToken,
}: {
  roomId: string
  admission: RoomAdmission
  inviteToken: string | undefined
}) {
  const session = Result.getOrElse(useAtomValue(sessionAtom), () => null)
  const join = useAtomSet(joinRoomAtom, { mode: "promiseExit" })
  const setActiveRoom = useAtomSet(activeRoomIdAtom)
  const [joining, setJoining] = useState(false)
  const [guestName, setGuestName] = useState("")
  const [guestError, setGuestError] = useState<string | null>(null)
  const room = admission.room
  const roomPath = `/rooms/${roomId}`

  const member = admission.status === "member"
  useEffect(() => {
    if (member) setActiveRoom(roomId)
  }, [member, roomId, setActiveRoom])
  if (member) return <RoomPending />

  const joinAsAccount = async () => {
    setJoining(true)
    const exit = await join({
      payload: { roomId, inviteToken },
      reactivityKeys: [
        roomReactivityKeys.lists,
        roomReactivityKeys.admission(roomId),
      ],
    })
    setJoining(false)
    if (Exit.isFailure(exit)) return toastRoomFailure(exit)
    setActiveRoom(roomId)
  }

  const joinAsGuest = async () => {
    const name = Schema.decodeUnknownOption(GuestDisplayName)(guestName)
    if (name._tag === "None") {
      setGuestError("Use 1–32 characters without < or >.")
      return
    }
    setJoining(true)
    setGuestError(null)
    try {
      const response = await fetch(
        new URL(`/api/rooms/${roomId}/guests`, apiUrl),
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ inviteToken, displayName: name.value }),
        }
      )
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        setGuestError(body?.message ?? "Unable to join as a guest.")
        setJoining(false)
        return
      }
      setActiveRoom(roomId)
      clearInviteToken(roomId)
      // The guest cookie only reaches the RPC socket on a new handshake.
      navigateAfterAuthChange(roomPath)
    } catch {
      setGuestError("Unable to reach the server. Try again.")
      setJoining(false)
    }
  }

  const signInHref = `/login?redirect=${encodeURIComponent(roomPath)}`

  return (
    <div className="mx-auto flex min-h-[70svh] w-full max-w-md flex-col justify-center gap-6 p-6">
      <title>Join room | AnimeKaiser</title>
      {room ? (
        <div className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
          <div className="flex items-start gap-3">
            {room.anime?.coverImage ? (
              <img
                src={room.anime.coverImage}
                alt=""
                className="h-24 w-16 rounded-xl object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground uppercase">
                {roomAccessLabel[room.access]} room
              </p>
              <h1 className="font-heading text-xl font-semibold">
                {room.name}
              </h1>
              {room.hostName ? (
                <p className="text-sm text-muted-foreground">
                  Hosted by {room.hostName}
                </p>
              ) : null}
              {room.anime ? (
                <p className="mt-1 text-sm">
                  <AnimeTitle title={room.anime.title} />
                  {room.episodeNumber ? ` · Episode ${room.episodeNumber}` : ""}
                </p>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {room.onlineCount} of {room.capacity} here now. Joining lets you
            read the room's saved chat, and others will see what you write.
          </p>
        </div>
      ) : (
        <h1 className="font-heading text-2xl font-semibold">Room</h1>
      )}

      {admission.status === "joinable" && session ? (
        <Button
          size="lg"
          disabled={joining}
          onClick={() => void joinAsAccount()}
        >
          {joining ? <Loader2 className="animate-spin" /> : null}
          Join room
        </Button>
      ) : admission.guestAllowed ? (
        <div className="flex flex-col gap-3">
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void joinAsGuest()
            }}
          >
            <Label htmlFor="guest-name">Your name in this room</Label>
            <Input
              id="guest-name"
              value={guestName}
              maxLength={32}
              autoComplete="nickname"
              aria-invalid={guestError !== null}
              aria-describedby="guest-help"
              onChange={(event) => setGuestName(event.currentTarget.value)}
            />
            <p id="guest-help" className="text-xs text-muted-foreground">
              Guests can watch, chat, and vote for up to 24 hours in this
              browser.
            </p>
            {guestError ? (
              <p className="text-sm text-destructive" role="alert">
                {guestError}
              </p>
            ) : null}
            <Button size="lg" type="submit" disabled={joining}>
              {joining ? <Loader2 className="animate-spin" /> : null}
              Join as guest
            </Button>
          </form>
          <Button variant="outline" asChild>
            <a href={signInHref}>Sign in instead</a>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {statusCopy[admission.status]}
          </p>
          {!session &&
          (admission.status === "sign_in_required" ||
            admission.status === "friends_only" ||
            admission.status === "invite_required") ? (
            <Button asChild>
              <a href={signInHref}>Sign in</a>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to="/rooms">Back to rooms</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
