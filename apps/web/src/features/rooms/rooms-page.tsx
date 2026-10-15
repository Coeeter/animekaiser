import type { RoomListTab, RoomSummary } from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import { Button } from "@animekaiser/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@animekaiser/ui/components/empty"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@animekaiser/ui/components/tabs"
import {
  Result,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link, useNavigate } from "@tanstack/react-router"
import * as Exit from "effect/Exit"
import { Loader2, Plus, Users } from "lucide-react"
import { useState } from "react"
import { DataError } from "../../components/data-error"
import { PageHero } from "../../components/page-hero"
import { AnimeTitle } from "../anime/common/anime-title"
import { sessionAtom } from "../auth/atoms"
import { displayUsername } from "../auth/user"
import {
  activeRoomIdAtom,
  declineRoomInvitationAtom,
  joinRoomAtom,
  roomAccessLabel,
  roomListAtom,
  roomReactivityKeys,
} from "./atoms"
import { CreateRoomDialog } from "./room-dialogs"
import { toastRoomFailure } from "./room-host"

const tabs: ReadonlyArray<{
  id: RoomListTab
  label: string
  empty: string
}> = [
  {
    id: "mine",
    label: "My rooms",
    empty: "Rooms you host or have joined appear here.",
  },
  {
    id: "friends",
    label: "Friends",
    empty: "Rooms your friends open for friends or the public appear here.",
  },
  {
    id: "invitations",
    label: "Invitations",
    empty: "When someone invites you to a room, it shows up here.",
  },
  {
    id: "public",
    label: "Public",
    empty: "No public rooms are open right now.",
  },
]

export function RoomsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const session = Result.getOrElse(useAtomValue(sessionAtom), () => null)
  const name = session ? `${displayUsername(session.user)}'s room` : "Our room"

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 pb-8 md:p-6">
      <PageHero
        icon={Users}
        kicker="Social"
        title="Rooms"
        description="Watch in sync and chat with friends. Voice stays in Discord."
      >
        <Button onClick={() => setCreateOpen(true)}>
          <Plus data-icon="inline-start" />
          Create room
        </Button>
      </PageHero>
      <Tabs defaultValue="mine" className="gap-4">
        <TabsList className="w-full overflow-x-auto sm:w-fit">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            <RoomList tab={tab.id} empty={tab.empty} />
          </TabsContent>
        ))}
      </Tabs>
      <CreateRoomDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultName={name}
        selection={null}
      />
    </div>
  )
}

function RoomList({ tab, empty }: { tab: RoomListTab; empty: string }) {
  const result = useAtomValue(roomListAtom(tab))
  const refresh = useAtomRefresh(roomListAtom(tab))
  return Result.builder(result)
    .onInitialOrWaiting(() => (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-3xl" />
        ))}
      </div>
    ))
    .onFailure(() => (
      <DataError title="Unable to load rooms" onRetry={refresh} />
    ))
    .onSuccess((rooms) =>
      rooms.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Nothing here yet</EmptyTitle>
            <EmptyDescription>{empty}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </ul>
      )
    )
    .render()
}

export function RoomCard({ room }: { room: RoomSummary }) {
  const decline = useAtomSet(declineRoomInvitationAtom, { mode: "promiseExit" })
  return (
    <li className="flex gap-3 rounded-3xl border bg-card p-3">
      {room.anime?.coverImage ? (
        <img
          src={room.anime.coverImage}
          alt=""
          className="h-24 w-16 shrink-0 rounded-2xl object-cover"
          loading="lazy"
        />
      ) : (
        <div className="grid h-24 w-16 shrink-0 place-items-center rounded-2xl bg-muted">
          <Users className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-medium">{room.name}</h3>
          {room.status === "closed" ? (
            <Badge variant="secondary">Closed</Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {roomAccessLabel[room.access]}
          {room.hostName
            ? ` · ${room.isHost ? "You host" : `Host ${room.hostName}`}`
            : ""}
          {` · ${room.onlineCount}/${room.capacity} here`}
        </p>
        <p className="truncate text-sm">
          {room.anime ? (
            <>
              <AnimeTitle title={room.anime.title} />
              {room.episodeNumber ? ` · EP ${room.episodeNumber}` : ""}
            </>
          ) : (
            <span className="text-muted-foreground">
              Choosing what to watch
            </span>
          )}
        </p>
        <div className="mt-auto flex gap-2 pt-1">
          {room.membership === "member" ? (
            <Button asChild size="sm">
              <Link to="/rooms/$roomId" params={{ roomId: room.id }}>
                {room.status === "closed" ? "Read history" : "Open"}
              </Link>
            </Button>
          ) : (
            <JoinRoomButton roomId={room.id} />
          )}
          {room.membership === "invited" ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void decline({
                  payload: { roomId: room.id },
                  reactivityKeys: [roomReactivityKeys.lists],
                }).then(toastRoomFailure)
              }
            >
              Decline
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function JoinRoomButton({ roomId }: { roomId: string }) {
  const join = useAtomSet(joinRoomAtom, { mode: "promiseExit" })
  const setActiveRoom = useAtomSet(activeRoomIdAtom)
  const navigate = useNavigate()
  const [joining, setJoining] = useState(false)
  return (
    <Button
      size="sm"
      disabled={joining}
      onClick={async () => {
        setJoining(true)
        const exit = await join({
          payload: { roomId },
          reactivityKeys: [
            roomReactivityKeys.lists,
            roomReactivityKeys.admission(roomId),
          ],
        })
        setJoining(false)
        if (Exit.isFailure(exit)) return toastRoomFailure(exit)
        setActiveRoom(roomId)
        void navigate({ to: "/rooms/$roomId", params: { roomId } })
      }}
    >
      {joining ? <Loader2 className="animate-spin" /> : null}
      Join
    </Button>
  )
}
