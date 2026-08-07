import type {
  StreamAudio,
  StreamPlayback,
  StreamProviderId,
} from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { useSidebar } from "@animekaiser/ui/components/sidebar"
import { useIsMobile } from "@animekaiser/ui/hooks/use-mobile"
import { cn } from "@animekaiser/ui/lib/utils"
import {
  Result,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link, useNavigate } from "@tanstack/react-router"
import { ListVideo, Server } from "lucide-react"
import type { MouseEvent, PointerEvent } from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { DataError } from "../../../components/data-error"
import { useResumePlayback } from "../../history/use-resume-playback"
import { useWatchProgress } from "../../history/use-watch-progress"
import { libraryEntryAtom } from "../../library/atoms"
import { streamEpisodesAtom, streamPlaybackAtom } from "../atoms"
import {
  miniPlayerFrameAtom,
  setMiniPlayerFrameAtom,
} from "../mini-player-frame"
import { nextStreamServer, videoFitClass } from "../player-format"
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
import { StreamPlayerPendingPage } from "./pending-page"
import { PlayerShell } from "./player-shell"
import { ServerSheet } from "./server-sheet"
import { playerCaptionAtom, playerUiAtom, updatePlayerUiAtom } from "./ui-state"
import {
  PlayerLoadingToast,
  PlayerSkipButton,
  PlayerSubtitleOverlay,
} from "./video-overlays"

const defaultCaptionValue = (playback: StreamPlayback) => {
  const defaultIndex = playback.tracks.findIndex((track) => track.default)
  if (defaultIndex >= 0) return String(defaultIndex)
  return playback.audio === "sub" && playback.tracks.length > 0 ? "0" : "off"
}

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

  return Result.builder(result)
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
                <Button
                  variant="outline"
                  onClick={() => setRecoveryEpisodesOpen(true)}
                >
                  <ListVideo data-icon="inline-start" />
                  Change provider or episode
                </Button>
              </div>
            </div>
          </PlayerShell>
          <EpisodeSheet
            open={recoveryEpisodesOpen}
            onOpenChange={setRecoveryEpisodesOpen}
            portalContainer={null}
            selection={input}
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

  const setServersOpen = (open: boolean) =>
    updatePlayerUi({ serversOpen: open })

  const videoPointerRef = useRef<{
    controlsWereVisible: boolean
    pointerType: string
  } | null>(null)

  const [subtitleCues, setSubtitleCues] = useState<Array<SubtitleCue>>([])
  const [syncedEpisodeKey, setSyncedEpisodeKey] = useState<string | null>(null)
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
  })

  const { fullscreen, toggleFullscreen } = useFullscreen({
    playerRef,
    videoRef: media.videoRef,
  })

  const { navigateToEpisode, toggleMiniPlayer } = useEpisodeNavigation({
    playback,
    serverId: input.serverId,
    mode,
    isMobile,
    fullscreen,
    toggleFullscreen,
  })

  const { flushWatchProgress } = useWatchProgress({
    playback,
    currentTime: media.currentTime,
    duration: media.duration,
    playing: media.playing,
  })

  useResumePlayback({ playback, videoRef: media.videoRef })

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

  const defaultCaption = defaultCaptionValue(playback)

  const selectedCaptionTrack =
    caption === "off" ? null : (playback.tracks[Number(caption)] ?? null)

  const activeSubtitle = subtitleHtmlAtTime(subtitleCues, media.currentTime)
  const episodeKey = `${playback.provider}:${playback.episode.id}:${playback.audio}`

  const catalog = Result.builder(episodesResult)
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

  const libraryEntry = Result.builder(libraryEntryResult)
    .onSuccess((value) => value)
    .orNull()

  const { finishEpisode } = usePlayerSync({
    playback,
    episodeKey,
    syncedEpisodeKey,
    onSyncedEpisodeKey: setSyncedEpisodeKey,
    libraryEntry,
    syncLibraryOnFinish: preferences.syncLibraryOnFinish,
    flushWatchProgress,
    navigateToEpisode,
    nextEpisode,
    autoNext: preferences.autoNext,
  })

  const cycleCaptions = () => {
    if (playback.tracks.length === 0) return

    const current = caption === "off" ? -1 : Number(caption)
    const next =
      current + 1 >= playback.tracks.length ? "off" : String(current + 1)

    setCaption(next)
  }

  usePlayerKeyboard({
    togglePlayback: media.togglePlayback,
    seekBy: media.seekBy,
    adjustVolume: media.adjustVolume,
    toggleMute: media.toggleMute,
    toggleFullscreen,
    cycleCaptions,
    toggleMiniPlayer,
    navigateToEpisode,
    revealControls,
    nextEpisode,
    previousEpisode,
  })

  useEffect(() => {
    setCaption(defaultCaption)
    setSyncedEpisodeKey(null)
    setSubtitleCues([])
  }, [defaultCaption, episodeKey])

  useEffect(() => {
    revealControls()
  }, [episodesOpen, media.playing, settingsOpen, revealControls])

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
    if (!preferences.autoplay) return
    const video = media.videoRef.current
    if (!video) return
    const play = () => {
      void video.play().catch(() => undefined)
    }
    video.addEventListener("canplay", play, { once: true })
    return () => video.removeEventListener("canplay", play)
  }, [media.videoRef, preferences.autoplay, sourceUrl])

  useEffect(() => {
    if (
      !preferences.autoSkipIntro ||
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
    media.skipTo(target)
  }, [
    media.currentTime,
    media.duration,
    media.skipTo,
    playback.intro,
    preferences.autoSkipIntro,
  ])

  useEffect(() => {
    if (
      !preferences.autoSkipOutro ||
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
    media.skipTo(target)
  }, [
    media.currentTime,
    media.duration,
    media.skipTo,
    playback.outro,
    preferences.autoSkipOutro,
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
    media.togglePlayback()
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

  return (
    <PlayerShell
      ref={playerRef}
      variant={mode}
      sidebarState={sidebarState}
      className={cn(
        mode === "mini" && miniPlayerClass,
        mode === "full" && !controlsVisible && media.playing && "cursor-none"
      )}
      onPointerMove={moveInteraction}
      onPointerDown={beginInteraction}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
    >
      <main
        className={cn(
          "relative flex items-center justify-center overflow-hidden bg-black",
          mode === "full" && !fullscreen
            ? "aspect-video w-full shrink-0 md:aspect-auto md:min-h-0 md:flex-1"
            : "min-h-0 flex-1",
          mode === "full" && !fullscreen && "sticky top-0 z-20 md:static"
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
          onEnded={finishEpisode}
        />

        {mode === "full" ? (
          <PlayerCenterIndicator
            icon={centerIndicatorIcon}
            visible={!(media.playing && !controlsVisible && !mediaLoading)}
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
          <div className="pointer-events-none absolute inset-x-4 bottom-14 z-30 flex flex-wrap justify-center gap-2 md:bottom-36">
            <PlayerSkipButton
              kind="intro"
              segment={playback.intro}
              currentTime={media.currentTime}
              duration={media.duration}
              onSkip={media.skipTo}
            />
            <PlayerSkipButton
              kind="outro"
              segment={playback.outro}
              currentTime={media.currentTime}
              duration={media.duration}
              onSkip={media.skipTo}
            />
          </div>
        ) : null}

        {mode === "full" ? (
          <PlayerMobileControls
            playback={playback}
            currentTime={media.currentTime}
            duration={media.duration}
            bufferedEnd={media.bufferedEnd}
            onSeek={media.seekTo}
            playing={media.playing}
            loading={mediaLoading}
            fullscreen={fullscreen}
            onTogglePlayback={media.togglePlayback}
            onToggleFullscreen={toggleFullscreen}
            onSeekBy={media.seekBy}
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
            onSeek={media.seekTo}
            playing={media.playing}
            loading={mediaLoading}
            muted={media.muted}
            volume={media.volume}
            fullscreen={fullscreen}
            onTogglePlayback={media.togglePlayback}
            onToggleMute={media.toggleMute}
            onVolumeChange={media.setVideoVolume}
            onToggleFullscreen={toggleFullscreen}
            onOpenEpisodes={() => setEpisodesOpen(true)}
            onOpenServers={() => setServersOpen(true)}
            controlsVisible={controlsVisible}
            playerPortalContainer={playerPortalContainer}
          />
        ) : (
          <PlayerMiniControls
            playback={playback}
            serverId={input.serverId}
            playing={media.playing}
            loading={mediaLoading}
            onTogglePlayback={media.togglePlayback}
            onSeekBy={media.seekBy}
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

      {mode === "full" && !fullscreen ? (
        <PlayerMobilePanel
          playback={playback}
          episodes={providerEpisodes}
          previousEpisode={previousEpisode}
          nextEpisode={nextEpisode}
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
          />
          <ServerSheet
            key={playback.server.id}
            open={serversOpen}
            onOpenChange={setServersOpen}
            portalContainer={playerPortalContainer}
            playback={playback}
          />
        </>
      ) : null}
    </PlayerShell>
  )
}
