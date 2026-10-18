import type {
  AnimeLibraryMetadata,
  RoomPick,
  RoomState,
  StreamProviderId,
} from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { Info, Play, Plus, ThumbsUp, X } from "lucide-react"
import { useState } from "react"
import { AnimeTitle } from "../anime/common/anime-title"
import { searchOpenAtom, searchPickAtom } from "../anime/common/search-atoms"
import { streamProvidersAtom } from "../streaming/atoms"
import { EpisodeSheet } from "../streaming/player/episode-sheet"
import { preferredProviderAtom } from "../streaming/preferences"
import {
  addRoomPickAtom,
  removeRoomPickAtom,
  selectRoomEpisodeAtom,
  toggleRoomVoteAtom,
} from "./atoms"
import { animeMetadataOf, toastRoomFailure } from "./room-host"

export function useAddToRoom(roomId: string) {
  const setPick = useAtomSet(searchPickAtom)
  const setSearchOpen = useAtomSet(searchOpenAtom)
  const add = useAtomSet(addRoomPickAtom, { mode: "promiseExit" })
  return () => {
    setPick({
      title: "Add to room",
      onPick: (anime) =>
        void add({
          payload: { roomId, anime: animeMetadataOf(anime) },
        }).then(toastRoomFailure),
    })
    setSearchOpen(true)
  }
}

export function RoomPicks({
  roomId,
  state,
}: {
  roomId: string
  state: RoomState
}) {
  const openSearch = useAddToRoom(roomId)
  const [choosing, setChoosing] = useState<AnimeLibraryMetadata | null>(null)
  const closed = state.status === "closed"
  const picks = [...state.picks].sort(
    (left, right) =>
      right.votes - left.votes || left.createdAt - right.createdAt
  )

  return (
    <div className="flex flex-col gap-3 p-4">
      {closed ? null : (
        <Button variant="outline" onClick={openSearch}>
          <Plus data-icon="inline-start" />
          Add anime
        </Button>
      )}
      {picks.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No picks yet. Anyone here can add anime and vote; the host makes the
          final choice.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {picks.map((pick) => (
            <PickCard
              key={pick.id}
              roomId={roomId}
              pick={pick}
              state={state}
              onChoose={() => setChoosing(pick.anime)}
            />
          ))}
        </ul>
      )}
      {choosing ? (
        <RoomEpisodeChooser
          roomId={roomId}
          anime={choosing}
          onClose={() => setChoosing(null)}
        />
      ) : null}
    </div>
  )
}

function PickCard({
  roomId,
  pick,
  state,
  onChoose,
}: {
  roomId: string
  pick: RoomPick
  state: RoomState
  onChoose: () => void
}) {
  const vote = useAtomSet(toggleRoomVoteAtom, { mode: "promiseExit" })
  const remove = useAtomSet(removeRoomPickAtom, { mode: "promiseExit" })
  const closed = state.status === "closed"
  const selected = state.selection?.anime.malId === pick.anime.malId

  return (
    <li
      className={cn(
        "flex gap-3 rounded-2xl border bg-card p-2.5",
        selected && "border-primary/60"
      )}
    >
      {pick.anime.coverImage ? (
        <img
          src={pick.anime.coverImage}
          alt=""
          className="h-20 w-14 shrink-0 rounded-xl bg-muted object-cover"
          loading="lazy"
        />
      ) : (
        <div className="h-20 w-14 shrink-0 rounded-xl bg-muted" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="line-clamp-2 text-sm leading-snug font-medium">
          <AnimeTitle title={pick.anime.title} />
        </p>
        <p className="text-xs text-muted-foreground">
          {pick.addedBy ? `Suggested by ${pick.addedBy}` : "Suggested"}
          {pick.anime.episodes ? ` · ${pick.anime.episodes} eps` : ""}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          <Button
            size="xs"
            variant={pick.votedByYou ? "default" : "outline"}
            aria-pressed={pick.votedByYou}
            aria-label={`Vote for this pick, ${pick.votes} ${pick.votes === 1 ? "vote" : "votes"}`}
            disabled={closed}
            onClick={() =>
              void vote({
                payload: { roomId, pickId: pick.id, vote: !pick.votedByYou },
              }).then(toastRoomFailure)
            }
          >
            <ThumbsUp data-icon="inline-start" />
            {pick.votes}
          </Button>
          <Button asChild size="xs" variant="ghost">
            <Link to="/series/$id" params={{ id: pick.anime.malId }}>
              <Info data-icon="inline-start" />
              Details
            </Link>
          </Button>
          {state.you.isHost && !closed ? (
            <>
              <Button size="xs" onClick={onChoose}>
                <Play data-icon="inline-start" />
                Choose
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="Remove from picks"
                onClick={() =>
                  void remove({
                    payload: { roomId, pickId: pick.id },
                  }).then(toastRoomFailure)
                }
              >
                <X />
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function RoomEpisodeChooser({
  roomId,
  anime,
  onClose,
}: {
  roomId: string
  anime: AnimeLibraryMetadata
  onClose: () => void
}) {
  const select = useAtomSet(selectRoomEpisodeAtom, { mode: "promiseExit" })
  const preferred = useAtomValue(preferredProviderAtom)
  const providers = AsyncResult.getOrElse(
    useAtomValue(streamProvidersAtom),
    () => []
  )
  const provider: StreamProviderId | undefined = preferred ?? providers[0]?.id
  if (!provider) return null
  return (
    <EpisodeSheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      portalContainer={null}
      title="Choose an episode for everyone"
      selection={{
        malId: anime.malId,
        provider,
        episodeId: "",
        audio: "sub",
      }}
      onChoose={({ provider: chosenProvider, episode, audio }) =>
        void select({
          payload: {
            roomId,
            selection: {
              anime,
              provider: chosenProvider,
              episodeId: episode.id,
              episodeNumber: episode.number,
              audio,
            },
          },
        }).then(toastRoomFailure)
      }
    />
  )
}
