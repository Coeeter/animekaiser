import type {
  StreamAudio,
  StreamPlayback,
  StreamProviderId,
} from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { useSidebar } from "@animekaiser/ui/components/sidebar"
import { useIsMobile } from "@animekaiser/ui/hooks/use-mobile"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import { Link, useNavigate } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { ListVideo, Server } from "lucide-react"
import type { MouseEvent, PointerEvent } from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { DataError } from "../../../components/data-error"
import { useResumePlayback } from "../../history/use-resume-playback"
import { useWatchProgress } from "../../history/use-watch-progress"
import { libraryEntryAtom } from "../../library/atoms"
import { RoomPlayerOverlay } from "../../rooms/room-overlays"
import {
  useRoomPlayer,
  useRoomSync,
  useRoomViewing,
} from "../../rooms/room-player"
import {
  type NextSeason,
  nextSeasonAtom,
  streamEpisodesAtom,
  streamPlaybackAtom,
} from "../atoms"
import {
  miniPlayerFrameAtom,
  setMiniPlayerFrameAtom,
} from "../mini-player-frame"
import {
  nextStreamServer,
  preferredAudio,
  videoFitClass,
} from "../player-format"
import { playerPreferencesAtom } from "../preferences"
import type { SubtitleCue } from "../subtitles"
import { parseSubtitleVtt, subtitleHtmlAtTime } from "../subtitles"
import {
  type CenterIndicatorIcon,
  PlayerCenterIndicator,
} from "./center-indicator"
import { PlayerDesktopControls } from "./desktop-controls"
import { EpisodeSheet } from "./episode-sheet"
import { useControlsVisibility } from "./hooks/use-controls"
import { useEpisodeNavigation } from "./hooks/use-episode-navigation"
import { useFullscreen } from "./hooks/use-fullscreen"
import { usePlayerKeyboard } from "./hooks/use-keyboard"
import { usePlayerMedia } from "./hooks/use-media"
import {
  type MiniResizeDirection,
  useMiniPlayerInteraction,
} from "./hooks/use-mini-interaction"
import { usePlayerSync } from "./hooks/use-player-sync"
import { PlayerMiniControls } from "./mini-controls"
import { PlayerMobileControls } from "./mobile-controls"
import { PlayerMobilePanel } from "./mobile-panel"
import { PlayerNextSeasonCard } from "./next-season-card"
import { StreamPlayerPendingPage } from "./pending-page"
import { PlayerShell } from "./player-shell"
import { ServerSheet } from "./server-sheet"
import { PlayerTheaterBar } from "./theater-bar"
import { playerCaptionAtom, playerUiAtom, updatePlayerUiAtom } from "./ui-state"
import {
  PlayerLoadingToast,
  PlayerSkipButton,
  PlayerSubtitleOverlay,
} from "./video-overlays"

const defaultCaptionValue = (
  playback: StreamPlayback,
  language: string | null
) => {
  if (language) {
    const preferred = language.toLowerCase()
    const index = playback.tracks.findIndex((track) =>
      track.label.toLowerCase().startsWith(preferred)
    )
    if (index >= 0) return String(index)
  }
  const defaultIndex = playback.tracks.findIndex((track) => track.default)
  if (defaultIndex >= 0) return String(defaultIndex)
  return playback.audio === "sub" && playback.tracks.length > 0 ? "0" : "off"
}

const noNextSeasonAtom = Atom.make(AsyncResult.success<NextSeason | null>(null))

export function StreamPlayerPage({
  input,
  mode = "full",
  onClose,
}: {
  input: StreamPlaybackInput
  mode?: "full" | "mini"
  onClose?: () => void
}) {
  const atom = streamPlaybackAtom(
    input.malId,
    input.provider,
    input.episodeId,
    input.audio,
    input.serverId
  )
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)
  const [recoveryEpisodesOpen, setRecoveryEpisodesOpen] = useState(false)
  const room = useRoomPlayer()

  return AsyncResult.builder(result)
    .onInitialOrWaiting(() =>
      mode === "mini" ? null : <StreamPlayerPendingPage mode="full" />
    )
    .onFailure(() =>
      mode === "mini" ? null : (
        <>
          <PlayerShell className="min-h-[70svh] justify-center md:min-h-0">
            <div className="m-auto flex w-full max-w-xl flex-col gap-4 p-4">
              <DataError
                title="Unable to load this stream"
                description="The selected server or provider may be unavailable."
                onRetry={refresh}
              />
              <div className="flex flex-wrap justify-center gap-2">
                {room ? (
                  <Button onClick={() => room.setServerId(undefined)}>
                    <Server data-icon="inline-start" />
                    Default server
                  </Button>
                ) : (
                  <Button asChild>
                    <Link
                      to="/watch/$malId/$provider/$episodeId"
                      params={{
                        malId: input.malId,
                        provider: input.provider,
                        episodeId: input.episodeId,
                      }}
                      search={{ audio: input.audio }}
                      replace
                    >
                      <Server data-icon="inline-start" />
                      Default server
                    </Link>
                  </Button>
                )}
                {!room || room.isHost ? (
                  <Button
                    variant="outline"
                    onClick={() => setRecoveryEpisodesOpen(true)}
                  >
                    <ListVideo data-icon="inline-start" />
                    Change provider or episode
                  </Button>
                ) : null}
              </div>
            </div>
          </PlayerShell>
          <EpisodeSheet
            open={recoveryEpisodesOpen}
            onOpenChange={setRecoveryEpisodesOpen}
            portalContainer={null}
            selection={input}
            onChoose={
              room
                ? ({ provider, episode, audio }) =>
                    room.selectEpisode(episode, audio, { provider })
                : undefined
            }
          />
        </>
      )
    )
    .onSuccess((playback) => {
      const title = playback.anime.title.english ?? playback.anime.title.romaji
      return (
        <>
          {mode === "full" ? (
            <title>{`${title} – Episode ${playback.episode.number} | AnimeKaiser`}</title>
          ) : null}
          <StreamPlayer
            input={input}
            playback={playback}
            loading={false}
            mode={mode}
            onClose={onClose}
          />
        </>
      )
    })
    .render()
}

export type StreamPlaybackInput = {
  malId: number
  provider: StreamProviderId
  episodeId: string
  audio: StreamAudio
  serverId?: string
}

const miniPlayerClass =
  "group/miniplayer fixed inset-auto right-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 h-auto aspect-video w-[min(24rem,calc(100vw-1.5rem))] min-w-64 max-w-[calc(100vw-1.5rem)] touch-none cursor-move overflow-hidden rounded-xl border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:right-5 md:bottom-5 md:left-auto"

const miniResizeHandles: ReadonlyArray<{
  direction: MiniResizeDirection
  className: string
}> = [
  { direction: "n", className: "inset-x-3 top-0 h-2 cursor-n-resize" },
  { direction: "ne", className: "top-0 right-0 size-3 cursor-ne-resize" },
  { direction: "e", className: "inset-y-3 right-0 w-2 cursor-e-resize" },
  { direction: "se", className: "right-0 bottom-0 size-3 cursor-se-resize" },
  { direction: "s", className: "inset-x-3 bottom-0 h-2 cursor-s-resize" },
  { direction: "sw", className: "bottom-0 left-0 size-3 cursor-sw-resize" },
  { direction: "w", className: "inset-y-3 left-0 w-2 cursor-w-resize" },
  { direction: "nw", className: "top-0 left-0 size-3 cursor-nw-resize" },
]

function StreamPlayer({
  input,
  playback,
  loading,
  mode,
  onClose,
}: {
  input: StreamPlaybackInput
  playback: StreamPlayback
  loading: boolean
  mode: "full" | "mini"
  onClose?: () => void
}) {
  const { state: sidebarState } = useSidebar()
  const isMobile = useIsMobile()

  const navigate = useNavigate()
  const playerRef = useRef<HTMLDivElement>(null)
  const room = useRoomPlayer()
  const [roomBlocked, setRoomBlocked] = useState(false)

  const preferences = useAtomValue(playerPreferencesAtom)
  const playerUi = useAtomValue(playerUiAtom)
  const updatePlayerUi = useAtomSet(updatePlayerUiAtom)

  const miniPlayerFrame = useAtomValue(miniPlayerFrameAtom)
  const setMiniPlayerFrame = useAtomSet(setMiniPlayerFrameAtom)

  const caption = useAtomValue(playerCaptionAtom)
  const setCaption = useAtomSet(playerCaptionAtom)

  const episodesResult = useAtomValue(
    streamEpisodesAtom(playback.anime.malId, playback.provider)
  )

  const libraryEntryResult = useAtomValue(
    libraryEntryAtom(playback.anime.malId)
  )

  const settingsOpen = playerUi.settingsOpen
  const episodesOpen = playerUi.episodesOpen
  const serversOpen = playerUi.serversOpen

  const setEpisodesOpen = (open: boolean) =>
    updatePlayerUi({ episodesOpen: open })

  const openEpisodes = () => {
    if (room && !room.isHost)
      toast.message("The host chooses episodes in this room.")
    else setEpisodesOpen(true)
  }

  const setServersOpen = (open: boolean) =>
    updatePlayerUi({ serversOpen: open })

  const videoPointerRef = useRef<{
    controlsWereVisible: boolean
    pointerType: string
  } | null>(null)

  const [subtitleCues, setSubtitleCues] = useState<Array<SubtitleCue>>([])
  const [syncedEpisodeKey, setSyncedEpisodeKey] = useState<string | null>(null)
  const [endedEpisodeKey, setEndedEpisodeKey] = useState<string | null>(null)
  const [playerElement, setPlayerElement] = useState<HTMLElement | null>(null)

  const sourceUrl = playback.sourceUrl

  const handleFatalPlaybackError = () => {
    const nextServer = nextStreamServer(
      playback.servers,
      playback.server.id,
      playback.audio
    )
    if (!nextServer) return false
    toast.message(`Trying ${nextServer.name}…`)
    if (room) {
      room.setServerId(nextServer.id)
      return true
    }
    void navigate({
      to: "/watch/$malId/$provider/$episodeId",
      params: {
        malId: playback.anime.malId,
        provider: playback.provider,
        episodeId: playback.episode.id,
      },
      search: { audio: playback.audio, serverId: nextServer.id },
      replace: true,
    })
    return true
  }

  const media = usePlayerMedia({
    sourceUrl,
    audioEnhancementPercent: preferences.audioEnhancementPercent,
    failureKey: `${playback.provider}:${playback.episode.id}:${playback.audio}:${playback.server.id}`,
    onFatalError: handleFatalPlaybackError,
    followRoom: room !== null,
  })

  const { fullscreen, toggleFullscreen } = useFullscreen({
    playerRef,
    videoRef: media.videoRef,
    autoLandscape: preferences.autoLandscape,
  })

  const { navigateToEpisode, toggleMiniPlayer } = useEpisodeNavigation({
    playback,
    serverId: input.serverId,
    mode,
    isMobile,
    fullscreen,
    toggleFullscreen,
    room,
  })

  const { flushWatchProgress } = useWatchProgress({
    playback,
    currentTime: media.currentTime,
    duration: media.duration,
    playing: media.playing,
    enabled: room === null,
  })

  useResumePlayback({
    playback,
    videoRef: media.videoRef,
    enabled: room === null,
  })

  const { joinPlayback } = useRoomSync({
    room,
    videoRef: media.videoRef,
    onBlocked: setRoomBlocked,
  })

  const blockedControl = () =>
    toast.message(
      room?.hostAway
        ? "Playback is paused until the host returns."
        : "The host controls playback."
    )

  const controls = room
    ? {
        togglePlayback: () => {
          const video = media.videoRef.current
          if (!video) return
          if (!room.canControl) return blockedControl()
          const positionSeconds = video.currentTime
          if (room.playback.playing) {
            video.pause()
            room.command({ _tag: "Pause", positionSeconds })
            return
          }
          void video.play().catch(() => undefined)
          room.command({ _tag: "Play", positionSeconds })
        },
        seekTo: (value: string) => {
          if (!room.canControl) return blockedControl()
          media.seekTo(value)
          room.command({ _tag: "Seek", positionSeconds: Number(value) })
        },
        seekBy: (seconds: number) => {
          const video = media.videoRef.current
          if (!video) return
          if (!room.canControl) return blockedControl()
          media.seekBy(seconds)
          room.command({ _tag: "Seek", positionSeconds: video.currentTime })
        },
        skipTo: (seconds: number) => {
          const video = media.videoRef.current
          if (!video) return
          if (!room.canControl) return blockedControl()
          video.currentTime = seconds
          room.command({ _tag: "Seek", positionSeconds: seconds })
        },
      }
    : {
        togglePlayback: media.togglePlayback,
        seekTo: media.seekTo,
        seekBy: media.seekBy,
        skipTo: media.skipTo,
      }

  const roomPlaybackState = !room?.controller
    ? "idle"
    : roomBlocked
      ? "blocked"
      : media.buffering
        ? "buffering"
        : "ready"
  const reportRoomStateRef = useRef(room?.reportState)
  reportRoomStateRef.current = room?.reportState
  useEffect(() => {
    reportRoomStateRef.current?.(roomPlaybackState)
  }, [roomPlaybackState])

  const { controlsVisible, controlsVisibleRef, hideControls, revealControls } =
    useControlsVisibility({
      playing: media.playing,
      settingsOpen,
      episodesOpen,
      serversOpen,
    })

  const {
    beginInteraction,
    moveInteraction,
    endInteraction,
    suppressVideoClickRef,
    applyMiniPlayerFrame,
    clearMiniPlayerFrame,
  } = useMiniPlayerInteraction({
    playerRef,
    setMiniPlayerFrame,
    mode,
  })

  const defaultCaption = defaultCaptionValue(
    playback,
    preferences.subtitleLanguage
  )

  const selectedCaptionTrack =
    caption === "off" ? null : (playback.tracks[Number(caption)] ?? null)

  const activeSubtitle = subtitleHtmlAtTime(subtitleCues, media.currentTime)
  const episodeKey = `${playback.provider}:${playback.episode.id}:${playback.audio}`

  const catalog = AsyncResult.builder(episodesResult)
    .onSuccess((value) => value)
    .orNull()

  const playbackProvider: string = playback.provider

  const provider =
    catalog?.providers.find((item) => item.provider === playbackProvider) ??
    null

  const providerEpisodes =
    provider?.status === "available" ? provider.episodes : []

  const episodeIndex = providerEpisodes.findIndex(
    (episode) => episode.id === playback.episode.id
  )

  const previousEpisode =
    episodeIndex > 0 ? (providerEpisodes[episodeIndex - 1] ?? null) : null

  const nextEpisode =
    episodeIndex >= 0 ? (providerEpisodes[episodeIndex + 1] ?? null) : null

  const libraryEntry = AsyncResult.builder(libraryEntryResult)
    .onSuccess((value) => value)
    .orNull()

  // Only the last episode of a finished show continues into the next entry
  // of the watch order; a gap in the provider's list mid-season does not.
  const finale =
    mode === "full" &&
    room === null &&
    !nextEpisode &&
    playback.anime.status === "FINISHED" &&
    (playback.anime.episodes === null ||
      playback.episode.number >= playback.anime.episodes)

  const nextSeason = AsyncResult.builder(
    useAtomValue(
      finale
        ? nextSeasonAtom({
            malId: playback.anime.malId,
            provider: playback.provider,
          })
        : noNextSeasonAtom
    )
  )
    .onSuccess((value) => value)
    .orNull()

  const navigateToNextSeason = () => {
    if (!nextSeason) return
    const { target } = nextSeason
    void navigate({
      to: "/watch/$malId/$provider/$episodeId",
      params: {
        malId: target.malId,
        provider: target.provider,
        episodeId: target.episodeId,
      },
      search: { audio: target.audio },
    })
  }

  const goNext = nextEpisode
    ? () => navigateToEpisode(nextEpisode)
    : nextSeason
      ? navigateToNextSeason
      : null

  const { finishEpisode, syncLibraryProgress } = usePlayerSync({
    playback,
    episodeKey,
    syncedEpisodeKey,
    onSyncedEpisodeKey: setSyncedEpisodeKey,
    libraryEntry,
    syncLibraryOnFinish: preferences.syncLibraryOnFinish,
    flushWatchProgress,
    onFinished: () => {
      if (preferences.autoNext && goNext) goNext()
      else setEndedEpisodeKey(episodeKey)
    },
  })

  useRoomViewing({
    room,
    playback,
    videoRef: media.videoRef,
    onCompleted: () => void syncLibraryProgress(),
  })

  const handleEnded = () => {
    if (!room) return finishEpisode()
    if (!room.isHost || !preferences.autoNext || !nextEpisode) return
    const audio = nextEpisode.availableAudio.includes(playback.audio)
      ? playback.audio
      : preferredAudio(nextEpisode)
    if (audio) room.selectEpisode(nextEpisode, audio, { play: true })
  }

  const cycleCaptions = () => {
    if (playback.tracks.length === 0) return

    const current = caption === "off" ? -1 : Number(caption)
    const next =
      current + 1 >= playback.tracks.length ? "off" : String(current + 1)

    setCaption(next)
  }

  usePlayerKeyboard({
    togglePlayback: controls.togglePlayback,
    seekBy: controls.seekBy,
    adjustVolume: media.adjustVolume,
    toggleMute: media.toggleMute,
    toggleFullscreen,
    cycleCaptions,
    toggleMiniPlayer,
    navigateToEpisode,
    revealControls,
    goNext: () => goNext?.(),
    previousEpisode,
  })

  useEffect(() => {
    setCaption(defaultCaption)
    setSyncedEpisodeKey(null)
    setSubtitleCues([])
  }, [defaultCaption, episodeKey])

  useEffect(() => {
    if (!selectedCaptionTrack) {
      setSubtitleCues([])
      return
    }

    let disposed = false
    setSubtitleCues([])
    void fetch(selectedCaptionTrack.file)
      .then((response) => (response.ok ? response.text() : ""))
      .then((text) => {
        if (!disposed) setSubtitleCues(parseSubtitleVtt(text))
      })
      .catch(() => {
        if (!disposed) setSubtitleCues([])
      })

    return () => {
      disposed = true
    }
  }, [selectedCaptionTrack])

  useEffect(() => {
    if (!preferences.autoplay || room) return
    const video = media.videoRef.current
    if (!video) return
    const play = () => {
      void video.play().catch(() => undefined)
    }
    video.addEventListener("canplay", play, { once: true })
    return () => video.removeEventListener("canplay", play)
  }, [media.videoRef, preferences.autoplay, sourceUrl, room])

  useEffect(() => {
    if (
      !preferences.autoSkipIntro ||
      (room && !room.isHost) ||
      !playback.intro ||
      media.currentTime < playback.intro.start ||
      media.currentTime > playback.intro.end
    ) {
      return
    }
    const target = Math.min(
      playback.intro.end + 2,
      media.duration > 0 ? media.duration : playback.intro.end + 2
    )
    controls.skipTo(target)
  }, [
    media.currentTime,
    media.duration,
    controls.skipTo,
    playback.intro,
    preferences.autoSkipIntro,
    room,
  ])

  useEffect(() => {
    if (
      !preferences.autoSkipOutro ||
      (room && !room.isHost) ||
      !playback.outro ||
      media.currentTime < playback.outro.start ||
      media.currentTime > playback.outro.end
    ) {
      return
    }
    const target = Math.min(
      playback.outro.end + 2,
      media.duration > 0 ? media.duration : playback.outro.end + 2
    )
    controls.skipTo(target)
  }, [
    media.currentTime,
    media.duration,
    controls.skipTo,
    playback.outro,
    preferences.autoSkipOutro,
    room,
  ])

  const captureVideoPointer = (event: PointerEvent<HTMLVideoElement>) => {
    videoPointerRef.current = {
      controlsWereVisible: controlsVisibleRef.current,
      pointerType: event.pointerType,
    }
  }

  const handleVideoClick = (event: MouseEvent<HTMLVideoElement>) => {
    if (suppressVideoClickRef.current) {
      suppressVideoClickRef.current = false
      event.preventDefault()
      return
    }

    const pointer = videoPointerRef.current
    videoPointerRef.current = null

    if (pointer && pointer.pointerType !== "mouse") {
      event.preventDefault()
      if (pointer.controlsWereVisible) {
        hideControls()
        return
      }
      revealControls()
      return
    }

    revealControls()
    controls.togglePlayback()
  }

  useLayoutEffect(() => {
    const player = playerRef.current
    if (!player) return

    if (mode === "full") {
      clearMiniPlayerFrame(player)
      return
    }

    if (!miniPlayerFrame) return

    const restore = () => applyMiniPlayerFrame(player, miniPlayerFrame)
    restore()
    window.addEventListener("resize", restore)
    return () => window.removeEventListener("resize", restore)
  }, [mode, miniPlayerFrame, applyMiniPlayerFrame, clearMiniPlayerFrame])

  useEffect(() => {
    setPlayerElement(playerRef.current)
  }, [])

  const mediaLoading = loading || media.buffering
  const centerIndicatorIcon: CenterIndicatorIcon = mediaLoading
    ? "loading"
    : media.playing
      ? "pause"
      : "play"
  const playerPortalContainer = playerElement
  const theater =
    mode === "full" &&
    !fullscreen &&
    room === null &&
    preferences.viewMode === "theater"
  const roomLayout = room !== null && mode === "full" && !fullscreen

  return (
    <PlayerShell
      ref={playerRef}
      variant={mode}
      sidebarState={sidebarState}
      className={cn(
        (theater || roomLayout) && "md:flex-row md:overflow-y-auto",
        mode === "mini" && miniPlayerClass,
        mode === "full" && !controlsVisible && media.playing && "cursor-none"
      )}
      onPointerMove={moveInteraction}
      onPointerDown={beginInteraction}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
    >
      <div
        className={
          theater
            ? "contents md:flex md:min-w-0 md:flex-1 md:flex-col md:gap-4 md:p-4"
            : roomLayout
              ? "contents md:flex md:min-w-0 md:flex-1 md:flex-col"
              : "contents"
        }
      >
        <main
          className={cn(
            "relative flex items-center justify-center overflow-hidden bg-black",
            theater
              ? "aspect-video w-full shrink-0 md:rounded-2xl"
              : mode === "full" && !fullscreen
                ? "aspect-video w-full shrink-0 md:aspect-auto md:min-h-0 md:flex-1"
                : "min-h-0 flex-1",
            mode === "full" &&
              !fullscreen &&
              (theater || roomLayout
                ? "sticky top-0 z-20 md:relative md:z-auto"
                : "sticky top-0 z-20 md:static")
          )}
          onPointerMove={revealControls}
          onPointerDown={revealControls}
        >
          <video
            ref={media.videoRef}
            className={cn(
              "absolute inset-0 h-full w-full bg-black",
              videoFitClass[preferences.videoFit]
            )}
            playsInline
            crossOrigin="anonymous"
            onPointerDown={captureVideoPointer}
            onClick={handleVideoClick}
            {...media.videoHandlers}
            onEnded={handleEnded}
          />

          {room ? (
            <RoomPlayerOverlay
              room={room}
              blocked={roomBlocked}
              onJoinPlayback={joinPlayback}
            />
          ) : null}

          {mode === "full" ? (
            <PlayerCenterIndicator
              icon={centerIndicatorIcon}
              visible={!media.playing || mediaLoading}
            />
          ) : null}

          <PlayerLoadingToast visible={loading} />

          <PlayerSubtitleOverlay
            html={activeSubtitle}
            mode={mode}
            controlsVisible={controlsVisible}
            preferences={preferences}
          />

          {mode === "full" ? (
            <div
              className={cn(
                "pointer-events-none absolute right-4 z-30 flex gap-2 transition-[bottom] duration-200 md:right-8",
                controlsVisible
                  ? "bottom-14 md:bottom-36"
                  : "bottom-4 md:bottom-10"
              )}
            >
              <PlayerSkipButton
                kind="intro"
                segment={playback.intro}
                currentTime={media.currentTime}
                duration={media.duration}
                onSkip={controls.skipTo}
              />
              <PlayerSkipButton
                kind="outro"
                segment={playback.outro}
                currentTime={media.currentTime}
                duration={media.duration}
                onSkip={controls.skipTo}
              />
            </div>
          ) : null}

          {nextSeason && endedEpisodeKey === episodeKey ? (
            <PlayerNextSeasonCard
              nextSeason={nextSeason}
              onPlay={navigateToNextSeason}
              onDismiss={() => setEndedEpisodeKey(null)}
            />
          ) : null}

          {mode === "full" ? (
            <PlayerMobileControls
              playback={playback}
              currentTime={media.currentTime}
              duration={media.duration}
              bufferedEnd={media.bufferedEnd}
              onSeek={controls.seekTo}
              playing={media.playing}
              loading={mediaLoading}
              fullscreen={fullscreen}
              onTogglePlayback={controls.togglePlayback}
              onToggleFullscreen={toggleFullscreen}
              onSeekBy={controls.seekBy}
              controlsVisible={controlsVisible}
              playerPortalContainer={playerPortalContainer}
            />
          ) : null}

          {mode === "full" ? (
            <PlayerDesktopControls
              playback={playback}
              currentTime={media.currentTime}
              duration={media.duration}
              bufferedEnd={media.bufferedEnd}
              onSeek={controls.seekTo}
              playing={media.playing}
              loading={mediaLoading}
              muted={media.muted}
              volume={media.volume}
              fullscreen={fullscreen}
              onTogglePlayback={controls.togglePlayback}
              onToggleMute={media.toggleMute}
              onVolumeChange={media.setVideoVolume}
              onToggleFullscreen={toggleFullscreen}
              onOpenEpisodes={openEpisodes}
              onOpenServers={() => setServersOpen(true)}
              controlsVisible={controlsVisible}
              playerPortalContainer={playerPortalContainer}
            />
          ) : (
            <PlayerMiniControls
              playback={playback}
              serverId={input.serverId}
              roomId={room?.roomId}
              playing={media.playing}
              loading={mediaLoading}
              onTogglePlayback={controls.togglePlayback}
              onSeekBy={controls.seekBy}
              onClose={onClose}
            />
          )}

          {mode === "mini"
            ? miniResizeHandles.map((handle) => (
                <div
                  key={handle.direction}
                  data-mini-resize={handle.direction}
                  className={cn("absolute z-40", handle.className)}
                />
              ))
            : null}
        </main>
        {theater ? <PlayerTheaterBar playback={playback} /> : null}
      </div>

      {roomLayout ? room?.panel : null}

      {mode === "full" && !fullscreen && !room ? (
        <PlayerMobilePanel
          rail={theater}
          playback={playback}
          currentTime={media.currentTime}
          episodes={providerEpisodes}
          previousEpisode={previousEpisode}
          onNext={goNext}
          nextLabel={nextEpisode || !nextSeason ? "Next" : "Next season"}
          onOpenEpisodes={() => setEpisodesOpen(true)}
          onOpenServers={() => setServersOpen(true)}
          onNavigateToEpisode={navigateToEpisode}
        />
      ) : null}

      {mode === "full" ? (
        <>
          <EpisodeSheet
            key={playback.provider}
            open={episodesOpen}
            onOpenChange={setEpisodesOpen}
            portalContainer={playerPortalContainer}
            selection={{
              malId: playback.anime.malId,
              provider: playback.provider,
              episodeId: playback.episode.id,
              audio: playback.audio,
            }}
            onChoose={
              room
                ? (choice) =>
                    room.selectEpisode(choice.episode, choice.audio, {
                      provider: choice.provider,
                    })
                : undefined
            }
          />
          <ServerSheet
            key={playback.server.id}
            open={serversOpen}
            onOpenChange={setServersOpen}
            portalContainer={playerPortalContainer}
            playback={playback}
            onChoose={room ? room.setServerId : undefined}
          />
        </>
      ) : null}
    </PlayerShell>
  )
}
