import type { RoomMessage, RoomState } from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import { Button } from "@animekaiser/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@animekaiser/ui/components/dropdown-menu"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@animekaiser/ui/components/tabs"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Link } from "@tanstack/react-router"
import {
  DoorOpen,
  Globe,
  Lock,
  MoreVertical,
  Settings2,
  UserPlus,
  Users,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { rpcConnectionStatusAtom } from "../../services/api-clients"
import { AnimeTitle } from "../anime/common/anime-title"
import { roomAccessLabel, roomComposerIntentAtom, roomLiveAtom } from "./atoms"
import { RoomChat } from "./room-chat"
import {
  CloseRoomDialog,
  InviteDialog,
  LeaveRoomDialog,
  RoomSettingsDialog,
} from "./room-dialogs"
import { liveOf } from "./room-host"
import { RoomPeople } from "./room-people"
import { RoomPicks } from "./room-picks"

type PanelTab = "chat" | "picks" | "people"

export function RoomPanel({
  roomId,
  variant,
}: {
  roomId: string
  variant: "rail" | "page"
}) {
  const live = liveOf(useAtomValue(roomLiveAtom(roomId)))
  const composerIntent = useAtomValue(roomComposerIntentAtom(roomId))
  const [tab, setTab] = useState<PanelTab>("chat")
  useEffect(() => {
    if (composerIntent) setTab("chat")
  }, [composerIntent])
  const state = live?.state
  const messages = live?.messages ?? []
  const lastSeq = messages.at(-1)?.seq ?? 0
  const [seenSeq, setSeenSeq] = useState(lastSeq)
  const unread =
    tab === "chat"
      ? 0
      : messages.filter(
          (message) => message.seq > seenSeq && message.kind !== "system"
        ).length

  useEffect(() => {
    if (tab === "chat") setSeenSeq(lastSeq)
  }, [tab, lastSeq])

  if (!state) return null

  const onlineCount = state.members.filter((member) => member.online).length

  return (
    <section
      aria-label={`Room ${state.name}`}
      className={cn(
        "flex min-h-0 flex-col bg-background text-foreground",
        variant === "rail"
          ? "w-full flex-1 md:flex-none md:sticky md:top-0 md:h-dvh md:w-96 md:shrink-0 md:border-l"
          : "h-full"
      )}
    >
      <RoomHeader state={state} connected={live.connected} />
      <RoomAnnouncer messages={messages} />
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as PanelTab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList className="mx-3 mt-2 grid w-auto grid-cols-3">
          <TabsTrigger value="chat">
            Chat
            {unread > 0 ? (
              <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                <span className="sr-only">, </span>
                {unread}
                <span className="sr-only"> unread</span>
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="picks">
            Picks
            {state.picks.length > 0 ? (
              <span className="ml-1 text-xs text-muted-foreground">
                {state.picks.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="people">
            People
            <span className="ml-1 text-xs text-muted-foreground">
              {onlineCount}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col">
          <RoomChat roomId={roomId} state={state} live={live} />
        </TabsContent>
        <TabsContent value="picks" className="min-h-0 flex-1 overflow-y-auto">
          <RoomPicks roomId={roomId} state={state} />
        </TabsContent>
        <TabsContent value="people" className="min-h-0 flex-1 overflow-y-auto">
          <RoomPeople roomId={roomId} state={state} />
        </TabsContent>
      </Tabs>
    </section>
  )
}

function RoomHeader({
  state,
  connected,
}: {
  state: RoomState
  connected: boolean
}) {
  const rpcStatus = useAtomValue(rpcConnectionStatusAtom)
  const online = connected && rpcStatus === "connected"
  const setComposerIntent = useAtomSet(roomComposerIntentAtom(state.id))
  const [inviteOpen, setInviteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState<"close" | "delete" | null>(null)
  const AccessIcon =
    state.access === "public"
      ? Globe
      : state.access === "friends"
        ? Users
        : Lock
  const closed = state.status === "closed"

  return (
    <header className="flex flex-col gap-2 border-b px-4 pt-3 pb-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {closed
              ? "Closed"
              : state.selection
                ? `Watching · EP ${state.selection.episodeNumber}`
                : "Choosing"}
          </p>
          <h2 className="truncate font-heading text-lg leading-tight font-semibold">
            {state.name}
          </h2>
          {state.selection ? (
            <p className="truncate text-sm text-muted-foreground">
              <AnimeTitle title={state.selection.anime.title} />
            </p>
          ) : null}
        </div>
        {!closed && state.aiAccess !== "off" ? (
          <Button
            size="sm"
            variant="outline"
            aria-label="Ask AI"
            title="Ask AI"
            disabled={!state.you.canAskAi}
            onClick={() =>
              setComposerIntent({ mention: "AI", id: crypto.randomUUID() })
            }
          >
            @AI
          </Button>
        ) : null}
        {state.you.isHost && !closed ? (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus data-icon="inline-start" />
            Invite
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Room options">
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {state.you.isHost && !closed ? (
              <>
                <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                  <Settings2 />
                  Room settings
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setInviteOpen(true)}>
                  <UserPlus />
                  Invite people
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setCloseOpen("close")}>
                  Close room
                </DropdownMenuItem>
              </>
            ) : null}
            {state.you.isHost ? (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setCloseOpen("delete")}
              >
                Delete room
              </DropdownMenuItem>
            ) : null}
            {state.you.isHost && !closed ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem onSelect={() => setLeaveOpen(true)}>
              <DoorOpen />
              Leave room
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/rooms">All rooms</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Badge variant="outline">
          <AccessIcon data-icon="inline-start" />
          {roomAccessLabel[state.access]}
        </Badge>
        {state.hostName ? (
          <span>
            Host <span className="text-foreground">{state.hostName}</span>
            {state.hostOnline ? "" : " · away"}
          </span>
        ) : null}
        <span
          className="ml-auto inline-flex items-center gap-1.5"
          role="status"
        >
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              online ? "bg-emerald-500" : "bg-amber-500"
            )}
          />
          {online ? "Connected" : "Reconnecting…"}
        </span>
      </div>
      {state.you.kind === "guest" && state.you.guestExpiresAt ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          You're a guest until{" "}
          {new Date(state.you.guestExpiresAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
          .{" "}
          <Link
            to="/register"
            className="font-medium text-foreground underline underline-offset-2"
          >
            Create an account
          </Link>{" "}
          to keep this room.
        </p>
      ) : null}
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        state={state}
      />
      <RoomSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        state={state}
      />
      <LeaveRoomDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        state={state}
        onClose={() => setCloseOpen("close")}
      />
      <CloseRoomDialog
        mode={closeOpen}
        onOpenChange={(open) => {
          if (!open) setCloseOpen(null)
        }}
        state={state}
      />
    </header>
  )
}

const announceIntervalMs = 4_000

// One throttled polite region for meaningful room changes; ordinary chat is
// not announced so screen reader users aren't flooded.
function RoomAnnouncer({ messages }: { messages: ReadonlyArray<RoomMessage> }) {
  const [text, setText] = useState("")
  const lastAnnounced = useRef(messages.at(-1)?.seq ?? 0)
  const lastAt = useRef(0)

  useEffect(() => {
    const latest = [...messages]
      .reverse()
      .find(
        (message) =>
          message.kind === "system" && message.seq > lastAnnounced.current
      )
    if (!latest) return
    const wait = Math.max(0, lastAt.current + announceIntervalMs - Date.now())
    const timeout = window.setTimeout(() => {
      lastAnnounced.current = latest.seq
      lastAt.current = Date.now()
      setText(latest.body)
    }, wait)
    return () => window.clearTimeout(timeout)
  }, [messages])

  return (
    <div aria-live="polite" role="status" className="sr-only">
      {text}
    </div>
  )
}
