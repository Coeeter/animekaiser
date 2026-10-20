import type {
  AnimeItem,
  AnimeLibraryMetadata,
  RoomOperationError,
  RoomPlayback,
  StreamAudio,
} from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { useIsMobile } from "@animekaiser/ui/hooks/use-mobile"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Link, useLocation } from "@tanstack/react-router"
import * as Cause from "effect/Cause"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as RpcClientError from "effect/rpc/RpcClientError"
import * as Schema from "effect/Schema"
import { Users } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { rpcConnectionStatusAtom } from "../../services/api-clients"
import { sessionAtom } from "../auth/atoms"
import { StreamPlayerPage } from "../streaming/player/page"
import {
  activeRoomIdAtom,
  claimRoomPlaybackAtom,
  commandRoomPlaybackAtom,
  convertRoomGuestAtom,
  endedRoomsAtom,
  type RoomLive,
  recordRoomViewingAtom,
  reportRoomPlaybackStateAtom,
  roomClockOffsetAtom,
  roomConnectionIdAtom,
  roomEndMessage,
  roomLiveAtom,
  selectRoomEpisodeAtom,
} from "./atoms"
import { RoomPanel } from "./room-panel"
import { RoomPlayerContext, type RoomPlayerController } from "./room-player"

export const animeMetadataOf = (
  anime: Pick<
    AnimeItem,
    | "malId"
    | "aniListId"
    | "title"
    | "coverImage"
    | "episodes"
    | "genres"
    | "seasonYear"
  >
): AnimeLibraryMetadata => ({
  malId: anime.malId,
  aniListId: anime.aniListId,
  title: anime.title,
  coverImage: anime.coverImage,
  episodes: anime.episodes,
  genres: anime.genres,
  seasonYear: anime.seasonYear,
})

export const roomErrorOf = (exit: Exit.Exit<unknown, unknown>) => {
  if (!Exit.isFailure(exit)) return null
  const failure = Cause.findErrorOption(exit.cause)
  if (Option.isNone(failure)) return null
  const error = failure.value as Partial<RoomOperationError>
  return error._tag === "RoomOperationError"
    ? (error as RoomOperationError)
    : null
}

const unexpectedFailureMessage = (exit: Exit.Failure<unknown, unknown>) => {
  const failure = Cause.squash(exit.cause)
  if (Schema.is(RpcClientError.RpcClientError)(failure))
    return "Can't reach AnimeKaiser right now. Check your connection and try again."
  if (failure instanceof Schema.SchemaError)
    return "Some of those details aren't valid. Check them and try again."
  return "Something went wrong on our side. Try again in a moment."
}

export const toastRoomFailure = (exit: Exit.Exit<unknown, unknown>) => {
  if (Exit.isSuccess(exit)) return
  const error = roomErrorOf(exit)
  if (error?.reason === "stale") return
  toast.error(error?.message ?? unexpectedFailureMessage(exit))
}

const serverOverrideAtom = Atom.family((_key: string) =>
  Atom.make<string | undefined>(undefined).pipe(Atom.keepAlive)
)

// Viewers pick their own audio edition; the room's selection stays the host's.
const audioOverrideAtom = Atom.family((_key: string) =>
  Atom.make<StreamAudio | undefined>(undefined).pipe(Atom.keepAlive)
)

export const roomPlayerHiddenAtom = Atom.family((_roomId: string) =>
  Atom.make(false).pipe(Atom.keepAlive)
)

const hostGraceMs = 30_000

export const liveOf = <E,>(result: AsyncResult.AsyncResult<RoomLive, E>) =>
  AsyncResult.isSuccess(result) ? result.value : null

export function RoomSessionHost() {
  const roomId = useAtomValue(activeRoomIdAtom)
  if (!roomId) return null
  return <ActiveRoom key={roomId} roomId={roomId} />
}

function ActiveRoom({ roomId }: { roomId: string }) {
  const live = liveOf(useAtomValue(roomLiveAtom(roomId)))
  const rpcStatus = useAtomValue(rpcConnectionStatusAtom)
  const clockOffset = AsyncResult.getOrElse(
    useAtomValue(roomClockOffsetAtom),
    () => 0
  )
  const session = AsyncResult.getOrElse(useAtomValue(sessionAtom), () => null)
  const connectionId = useAtomValue(roomConnectionIdAtom(roomId))
  const setActiveRoom = useAtomSet(activeRoomIdAtom)
  const setEndedRooms = useAtomSet(endedRoomsAtom)
  const location = useLocation()
  const isMobile = useIsMobile()
  const expanded = location.pathname === `/rooms/${roomId}`
  const hidden = useAtomValue(roomPlayerHiddenAtom(roomId))
  const setHidden = useAtomSet(roomPlayerHiddenAtom(roomId))

  const command = useAtomSet(commandRoomPlaybackAtom, { mode: "promiseExit" })
  const select = useAtomSet(selectRoomEpisodeAtom, { mode: "promiseExit" })
  const claim = useAtomSet(claimRoomPlaybackAtom, { mode: "promiseExit" })
  const report = useAtomSet(reportRoomPlaybackStateAtom, {
    mode: "promiseExit",
  })
  const record = useAtomSet(recordRoomViewingAtom, { mode: "promiseExit" })
  const convert = useAtomSet(convertRoomGuestAtom, { mode: "promiseExit" })

  const [playbackIntent, setPlaybackIntent] = useState<{
    id: string
    selectionRevision: number
    basePositionAt: number
    playback: RoomPlayback
    acknowledged: boolean
  } | null>(null)
  const state = live?.state ?? null
  const selection = state?.selection ?? null
  const serverKey = `${roomId}:${selection?.revision ?? 0}`
  const serverId = useAtomValue(serverOverrideAtom(serverKey))
  const setServerId = useAtomSet(serverOverrideAtom(serverKey))
  const audioOverride = useAtomValue(audioOverrideAtom(serverKey))
  const setAudioOverride = useAtomSet(audioOverrideAtom(serverKey))

  const ended = live?.ended ?? null
  const failure = live?.failure ?? null
  useEffect(() => {
    if (!ended && !failure) return
    const message = ended
      ? roomEndMessage[ended]
      : (failure?.message ?? "This room is unavailable.")
    if (!expanded) toast.message(message)
    setEndedRooms((current) => new Map(current).set(roomId, message))
    setActiveRoom(null)
  }, [ended, failure, expanded, roomId, setActiveRoom, setEndedRooms])

  // Closed rooms stay readable on their page but stop following you around.
  const closed = state?.status === "closed"
  useEffect(() => {
    if (closed && !expanded) setActiveRoom(null)
  }, [closed, expanded, setActiveRoom])

  useEffect(() => {
    if (expanded) setHidden(false)
  }, [expanded, setHidden])

  const [, setGraceTick] = useState(0)
  const hostAwaySince = state?.hostAwaySince ?? null
  useEffect(() => {
    if (hostAwaySince === null) return
    const remaining = hostAwaySince + hostGraceMs - (Date.now() + clockOffset)
    if (remaining <= 0) return
    const timeout = window.setTimeout(
      () => setGraceTick((tick) => tick + 1),
      remaining + 100
    )
    return () => window.clearTimeout(timeout)
  }, [hostAwaySince, clockOffset])

  const converting = useRef(false)
  const guestWithAccount = session !== null && state?.you.kind === "guest"
  useEffect(() => {
    if (!guestWithAccount || converting.current) return
    converting.current = true
    void convert({ payload: { roomId } }).then((exit) => {
      if (Exit.isSuccess(exit))
        toast.success("This room is now on your account.")
      else toastRoomFailure(exit)
    })
  }, [guestWithAccount, convert, roomId])

  if (!state) return null

  const connected = Boolean(live?.connected) && rpcStatus === "connected"
  const hostAway =
    state.hostAwaySince !== null &&
    Date.now() + clockOffset - state.hostAwaySince > hostGraceMs

  // Keep the host's local command in effect until its acknowledgement and
  // a newer server anchor arrive; an older snapshot must not undo the click.
  const pendingPlayback =
    playbackIntent &&
    selection &&
    state.you.canControlPlayback &&
    playbackIntent.selectionRevision === selection.revision &&
    (!playbackIntent.acknowledged ||
      state.playback.positionAt === playbackIntent.basePositionAt)
      ? playbackIntent.playback
      : null
  const localPlayback = pendingPlayback ?? state.playback

  const controller: RoomPlayerController | null = selection
    ? {
        roomId,
        selectionRevision: selection.revision,
        playback: localPlayback,
        clockOffset,
        canControl: state.you.canControlPlayback,
        isHost: state.you.isHost,
        isAccount: state.you.kind === "account" && session !== null,
        controller: state.you.controller,
        connected,
        hostAway,
        hostReconnecting: state.hostAwaySince !== null && !hostAway,
        panel: <RoomPanel roomId={roomId} variant="rail" />,
        command: (action) => {
          const id = crypto.randomUUID()
          setPlaybackIntent({
            id,
            selectionRevision: selection.revision,
            basePositionAt: state.playback.positionAt,
            acknowledged: false,
            playback: {
              ...localPlayback,
              positionSeconds: action.positionSeconds,
              positionAt: Date.now() + clockOffset,
              ...(action._tag === "Play"
                ? { playing: true }
                : action._tag === "Pause"
                  ? { playing: false }
                  : action._tag === "Rate"
                    ? { rate: action.rate }
                    : {}),
            },
          })
          void command({
            payload: { roomId, selectionRevision: selection.revision, action },
          }).then((exit) => {
            toastRoomFailure(exit)
            setPlaybackIntent((current) =>
              current?.id !== id
                ? current
                : Exit.isFailure(exit)
                  ? null
                  : { ...current, acknowledged: true }
            )
          })
        },
        selectEpisode: (episode, audio, options) =>
          void select({
            payload: {
              roomId,
              play: options?.play,
              selection: {
                anime: selection.anime,
                provider: options?.provider ?? selection.provider,
                episodeId: episode.id,
                episodeNumber: episode.number,
                audio,
              },
            },
          }).then(toastRoomFailure),
        setServerId,
        setAudio: (audio) => {
          setServerId(undefined)
          setAudioOverride(audio === selection.audio ? undefined : audio)
        },
        claimPlayback: () =>
          void claim({ payload: { roomId, connectionId } }).then(
            toastRoomFailure
          ),
        reportState: (playbackState) =>
          void report({
            payload: { roomId, connectionId, state: playbackState },
          }),
        recordViewing: async ({
          playback,
          positionSeconds,
          durationSeconds,
          segment,
        }) => {
          const exit = await record({
            payload: {
              roomId,
              anime: animeMetadataOf(playback.anime),
              provider: playback.provider,
              episodeId: playback.episode.id,
              serverId: playback.server.id,
              serverName: playback.server.name,
              episode: Math.max(1, Math.floor(playback.episode.number)),
              audio: playback.audio,
              positionSeconds,
              durationSeconds,
              segment,
            },
          })
          return Exit.isSuccess(exit) && exit.value.newlyCompleted
        },
      }
    : null

  const showPlayer =
    controller !== null && !(isMobile && !expanded) && !(hidden && !expanded)

  return (
    <>
      {showPlayer && selection ? (
        <RoomPlayerContext.Provider value={controller}>
          <StreamPlayerPage
            input={{
              malId: selection.anime.malId,
              provider: selection.provider,
              episodeId: selection.episodeId,
              audio: audioOverride ?? selection.audio,
              serverId,
            }}
            mode={expanded ? "full" : "mini"}
            onClose={() => setHidden(true)}
          />
        </RoomPlayerContext.Provider>
      ) : null}
      {!expanded && (!showPlayer || isMobile) ? (
        <InRoomChip roomId={roomId} name={state.name} connected={connected} />
      ) : null}
    </>
  )
}

function InRoomChip({
  roomId,
  name,
  connected,
}: {
  roomId: string
  name: string
  connected: boolean
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3 md:right-5 md:bottom-5 md:left-auto">
      <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border bg-background/95 py-1.5 pr-1.5 pl-3 text-sm shadow-lg backdrop-blur">
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            connected ? "bg-emerald-500" : "bg-amber-500"
          )}
        />
        <Users className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">
          In room · <span className="font-medium">{name}</span>
        </span>
        <Button asChild size="sm" className="rounded-full">
          <Link to="/rooms/$roomId" params={{ roomId }}>
            Return
          </Link>
        </Button>
      </div>
    </div>
  )
}
