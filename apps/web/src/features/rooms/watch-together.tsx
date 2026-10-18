import type {
  AnimeItem,
  RoomEpisodeSelection,
  StreamPlayback,
  StreamProviderId,
} from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { useAtomValue } from "@effect/atom-react"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { Users } from "lucide-react"
import type { ComponentProps } from "react"
import { useState } from "react"
import { getAnimeTitle } from "../anime/common/title"
import { sessionAtom } from "../auth/atoms"
import { streamProvidersAtom } from "../streaming/atoms"
import { EpisodeSheet } from "../streaming/player/episode-sheet"
import { preferredProviderAtom } from "../streaming/preferences"
import { activeRoomIdAtom } from "./atoms"
import { CreateRoomDialog } from "./room-dialogs"
import { animeMetadataOf } from "./room-host"

type ButtonProps = Pick<
  ComponentProps<typeof Button>,
  "size" | "variant" | "className"
>

function useSignedIn() {
  return AsyncResult.getOrElse(useAtomValue(sessionAtom), () => null) !== null
}

export function WatchTogetherButton({
  anime,
  provider,
  ...button
}: ButtonProps & {
  anime: AnimeItem
  provider?: StreamProviderId
}) {
  const signedIn = useSignedIn()
  const preferred = useAtomValue(preferredProviderAtom)
  const providers = AsyncResult.getOrElse(
    useAtomValue(streamProvidersAtom),
    () => []
  )
  const activeRoom = useAtomValue(activeRoomIdAtom)
  const [choosing, setChoosing] = useState(false)
  const [selection, setSelection] = useState<RoomEpisodeSelection | null>(null)
  const initialProvider = provider ?? preferred ?? providers[0]?.id

  if (activeRoom)
    return (
      <Button asChild variant="outline" {...button}>
        <Link to="/rooms/$roomId" params={{ roomId: activeRoom }}>
          <Users data-icon="inline-start" />
          Return to room
        </Link>
      </Button>
    )

  if (!signedIn)
    return (
      <Button asChild variant="outline" {...button}>
        <Link to="/login" search={{ redirect: `/series/${anime.malId}` }}>
          <Users data-icon="inline-start" />
          Watch together
        </Link>
      </Button>
    )

  return (
    <>
      <Button variant="outline" {...button} onClick={() => setChoosing(true)}>
        <Users data-icon="inline-start" />
        Watch together
      </Button>
      {initialProvider && choosing ? (
        <EpisodeSheet
          open
          onOpenChange={setChoosing}
          portalContainer={null}
          title="Choose an episode to watch together"
          selection={{
            malId: anime.malId,
            provider: initialProvider,
            episodeId: "",
            audio: "sub",
          }}
          onChoose={({ provider: chosen, episode, audio }) =>
            setSelection({
              anime: animeMetadataOf(anime),
              provider: chosen,
              episodeId: episode.id,
              episodeNumber: episode.number,
              audio,
            })
          }
        />
      ) : null}
      {selection ? (
        <CreateRoomDialog
          open
          onOpenChange={(open) => {
            if (!open) setSelection(null)
          }}
          defaultName={getAnimeTitle(anime.title, "english")}
          selection={selection}
        />
      ) : null}
    </>
  )
}

export function PlayerWatchTogether({
  playback,
  currentTime,
  variant = "ghost",
  size = "sm",
  className,
}: ButtonProps & {
  playback: StreamPlayback
  currentTime: number
}) {
  const signedIn = useSignedIn()
  const [position, setPosition] = useState<number | null>(null)
  if (!signedIn) return null
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setPosition(Math.floor(currentTime))}
      >
        <Users />
        <span>Watch together</span>
      </Button>
      {position !== null ? (
        <CreateRoomDialog
          open
          onOpenChange={(open) => {
            if (!open) setPosition(null)
          }}
          defaultName={getAnimeTitle(playback.anime.title, "english")}
          selection={{
            anime: animeMetadataOf(playback.anime),
            provider: playback.provider,
            episodeId: playback.episode.id,
            episodeNumber: playback.episode.number,
            audio: playback.audio,
          }}
          positionSeconds={position}
        />
      ) : null}
    </>
  )
}
