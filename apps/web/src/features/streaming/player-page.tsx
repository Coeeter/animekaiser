import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { useNavigate } from "@tanstack/react-router"
import type { StreamEpisode, StreamPlayback } from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArrowLeft,
  ListVideo,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react"
import type { ComponentPropsWithoutRef, MouseEvent, PointerEvent } from "react"
import { forwardRef, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { AnimeTitle } from "../anime/anime-title"
import {
  libraryEntryAtom,
  libraryMutationKeys,
  upsertLibraryAtom,
} from "../library/atoms"
import { streamEpisodesAtom, streamPlaybackAtom } from "./atoms"
import { EpisodeSheet } from "./player-episode-sheet"
import {
  episodeLabel,
  episodeTitle,
  preferredAudio,
  providerLabel,
  seriesEpisodesHref,
  videoFitClass,
} from "./player-format"
import { PlayerSettingsPopover } from "./player-settings-popover"
import { PlayerTimeline } from "./player-timeline"
import {
  playerCaptionAtom,
  playerUiAtom,
  updatePlayerUiAtom,
} from "./player-ui-state"
import { playerPreferencesAtom } from "./preferences"
import { streamProxyUrl } from "./proxy"
import type { StreamPlaybackInput } from "./streaming.functions"
import { subtitleStyle } from "./subtitle-settings"
import type { SubtitleCue } from "./subtitles"
import { parseSubtitleVtt, subtitleHtmlAtTime } from "./subtitles"
import { usePlayerMedia } from "./use-player-media"

const PlayerShell = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-black text-white [@media_(max-width:767px)_and_(orientation:portrait)]:top-0 [@media_(max-width:767px)_and_(orientation:portrait)]:right-auto [@media_(max-width:767px)_and_(orientation:portrait)]:bottom-auto [@media_(max-width:767px)_and_(orientation:portrait)]:left-[100dvw] [@media_(max-width:767px)_and_(orientation:portrait)]:h-[100dvw] [@media_(max-width:767px)_and_(orientation:portrait)]:w-[100dvh] [@media_(max-width:767px)_and_(orientation:portrait)]:origin-top-left [@media_(max-width:767px)_and_(orientation:portrait)]:rotate-90",
        className
      )}
      {...props}
    />
  )
)
PlayerShell.displayName = "PlayerShell"

const defaultCaptionValue = (playback: StreamPlayback) => {
  const defaultIndex = playback.tracks.findIndex((track) => track.default)
  if (defaultIndex >= 0) return String(defaultIndex)
  return playback.audio === "sub" && playback.tracks.length > 0 ? "0" : "off"
}

const skipSegmentVisible = (
  segment: StreamPlayback["intro"],
  currentTime: number
) => {
  if (!segment) return false
  return currentTime >= segment.start && currentTime <= segment.end
}

const skipTarget = (segment: StreamPlayback["intro"], duration: number) => {
  if (!segment) return 0
  const target = segment.end + 2
  return duration > 0 ? Math.min(target, duration) : target
}

const isEditingKeyboardTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLInputElement) return target.type !== "range"
  return (
    target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
  )
}

export function StreamPlayerPage({
  input,
  initial,
}: {
  input: StreamPlaybackInput
  initial: StreamPlayback
}) {
  const result = useAtomValue(
    streamPlaybackAtom(
      input.malId,
      input.provider,
      input.episodeId,
      input.audio,
      input.serverId
    )
  )
  const playback = Result.match(result, {
    onInitial: () => initial,
    onFailure: () => initial,
    onSuccess: ({ value }) => value,
  })
  const loading = Result.isWaiting(result)

  return <StreamPlayer playback={playback} loading={loading} />
}

export function StreamPlayerPendingPage() {
  return (
    <PlayerShell>
      <div className="flex items-center justify-between gap-3 p-4">
        <Skeleton className="h-9 w-28 bg-white/10" />
        <Skeleton className="h-9 w-24 bg-white/10" />
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex w-full max-w-5xl flex-col gap-4">
          <Skeleton className="aspect-video w-full rounded-2xl bg-white/10" />
          <div className="flex items-center justify-center gap-2 text-sm text-white/70">
            <Loader2 className="size-4 animate-spin" />
            Loading stream…
          </div>
        </div>
      </div>
    </PlayerShell>
  )
}

function StreamPlayer({
  playback,
  loading,
}: {
  playback: StreamPlayback
  loading: boolean
}) {
  const navigate = useNavigate()
  const playerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<number | null>(null)
  const upsertLibrary = useAtomSet(upsertLibraryAtom, { mode: "promise" })
  const preferences = useAtomValue(playerPreferencesAtom)
  const playerUi = useAtomValue(playerUiAtom)
  const updatePlayerUi = useAtomSet(updatePlayerUiAtom)
  const caption = useAtomValue(playerCaptionAtom)
  const setCaption = useAtomSet(playerCaptionAtom)
  const episodesResult = useAtomValue(streamEpisodesAtom(playback.anime.malId))
  const libraryEntryResult = useAtomValue(
    libraryEntryAtom(playback.anime.malId)
  )
  const settingsOpen = playerUi.settingsOpen
  const episodesOpen = playerUi.episodesOpen
  const setEpisodesOpen = (open: boolean) =>
    updatePlayerUi({ episodesOpen: open })
  const [controlsVisible, setControlsVisible] = useState(true)
  const controlsVisibleRef = useRef(controlsVisible)
  const videoPointerRef = useRef<{
    controlsWereVisible: boolean
    pointerType: string
  } | null>(null)
  const [subtitleCues, setSubtitleCues] = useState<Array<SubtitleCue>>([])
  const [syncedEpisodeKey, setSyncedEpisodeKey] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [playerElement, setPlayerElement] = useState<HTMLElement | null>(null)
  const sourceUrl = streamProxyUrl(
    playback.sourceUrl,
    playback.sourceRefererUrl
  )
  const media = usePlayerMedia({
    sourceUrl,
    audioEnhancementPercent: preferences.audioEnhancementPercent,
  })
  const defaultCaption = defaultCaptionValue(playback)
  const selectedCaptionTrack =
    caption === "off" ? null : (playback.tracks[Number(caption)] ?? null)
  const activeSubtitle = subtitleHtmlAtTime(subtitleCues, media.currentTime)
  const episodeKey = `${playback.provider}:${playback.episode.id}:${playback.audio}`
  const catalog = Result.match(episodesResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  })
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
  const libraryEntry = Result.match(libraryEntryResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  })

  const clearControlsTimeout = () => {
    if (controlsTimeoutRef.current === null) return
    window.clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = null
  }

  const revealControls = () => {
    clearControlsTimeout()
    setControlsVisible(true)
    if (!media.playing || settingsOpen || episodesOpen) return
    controlsTimeoutRef.current = window.setTimeout(() => {
      setControlsVisible(false)
    }, 2500)
  }

  const audioForEpisode = (episode: StreamEpisode) =>
    episode.availableAudio.includes(playback.audio)
      ? playback.audio
      : preferredAudio(episode)

  const navigateToEpisode = (episode: StreamEpisode | null) => {
    if (!episode) return
    const audio = audioForEpisode(episode)
    if (!audio) return
    void navigate({
      to: "/watch/$malId/$provider/$episodeId",
      params: {
        malId: playback.anime.malId,
        provider: playback.provider,
        episodeId: episode.id,
      },
      search: { audio },
    })
  }

  const syncLibraryProgress = async () => {
    if (syncedEpisodeKey === episodeKey) return

    const episodeProgress = Math.max(0, Math.floor(playback.episode.number))
    const progress = Math.max(libraryEntry?.progress ?? 0, episodeProgress)
    const totalEpisodes = playback.anime.episodes
    const completed = totalEpisodes !== null && progress >= totalEpisodes
    const status = completed ? "completed" : "watching"

    try {
      await upsertLibrary({
        payload: {
          anime: {
            malId: playback.anime.malId,
            aniListId: playback.anime.aniListId,
            title: playback.anime.title,
            coverImage: playback.anime.coverImage,
            episodes: playback.anime.episodes,
          },
          status,
          score: libraryEntry?.score ?? null,
          progress,
          notes: libraryEntry?.notes ?? null,
          syncExternal: preferences.syncLibraryOnFinish,
        },
        reactivityKeys: libraryMutationKeys(playback.anime.malId),
      })
      setSyncedEpisodeKey(episodeKey)
    } catch {
      toast.error("Log in to sync episode progress to your library.")
    }
  }

  const finishEpisode = () => {
    void syncLibraryProgress()
    if (preferences.autoNext) navigateToEpisode(nextEpisode)
  }

  const cycleCaptions = () => {
    if (playback.tracks.length === 0) return
    const current = caption === "off" ? -1 : Number(caption)
    const next =
      current + 1 >= playback.tracks.length ? "off" : String(current + 1)
    setCaption(next)
  }

  useEffect(() => {
    setCaption(defaultCaption)
    setSyncedEpisodeKey(null)
    setSubtitleCues([])
  }, [defaultCaption, episodeKey])

  useEffect(() => {
    revealControls()
    return clearControlsTimeout
  }, [episodesOpen, media.playing, settingsOpen])

  useEffect(() => {
    if (!selectedCaptionTrack) {
      setSubtitleCues([])
      return
    }

    let disposed = false
    setSubtitleCues([])
    void fetch(
      streamProxyUrl(selectedCaptionTrack.file, playback.sourceRefererUrl)
    )
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
  }, [playback.sourceRefererUrl, selectedCaptionTrack])

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
      !skipSegmentVisible(playback.intro, media.currentTime)
    ) {
      return
    }
    media.skipTo(skipTarget(playback.intro, media.duration))
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
      !skipSegmentVisible(playback.outro, media.currentTime)
    ) {
      return
    }
    media.skipTo(skipTarget(playback.outro, media.duration))
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
    const pointer = videoPointerRef.current
    videoPointerRef.current = null
    revealControls()

    if (
      pointer &&
      pointer.pointerType !== "mouse" &&
      !pointer.controlsWereVisible
    ) {
      event.preventDefault()
      return
    }

    media.togglePlayback()
  }

  const toggleFullscreen = () => {
    const player = playerRef.current
    if (!player) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }
    void player.requestFullscreen()
  }

  useEffect(() => {
    setPlayerElement(playerRef.current)
  }, [])

  useEffect(() => {
    controlsVisibleRef.current = controlsVisible
  }, [controlsVisible])

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        isEditingKeyboardTarget(event.target) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return
      }

      if (event.key === " " || event.key.toLowerCase() === "k") {
        event.preventDefault()
        media.togglePlayback()
        revealControls()
        return
      }
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "j") {
        event.preventDefault()
        media.seekBy(-10)
        revealControls()
        return
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "l") {
        event.preventDefault()
        media.seekBy(10)
        revealControls()
        return
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        media.adjustVolume(0.05)
        revealControls()
        return
      }
      if (event.key === "ArrowDown") {
        event.preventDefault()
        media.adjustVolume(-0.05)
        revealControls()
        return
      }
      if (event.key.toLowerCase() === "m") {
        event.preventDefault()
        media.toggleMute()
        revealControls()
        return
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault()
        toggleFullscreen()
        revealControls()
        return
      }
      if (event.key.toLowerCase() === "c") {
        event.preventDefault()
        cycleCaptions()
        revealControls()
        return
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault()
        navigateToEpisode(nextEpisode)
        return
      }
      if (event.key.toLowerCase() === "p") {
        event.preventDefault()
        navigateToEpisode(previousEpisode)
      }
    }
    window.addEventListener("keydown", keydown)
    return () => window.removeEventListener("keydown", keydown)
  })

  const intro = playback.intro
  const outro = playback.outro
  const showIntroSkip = skipSegmentVisible(intro, media.currentTime)
  const showOutroSkip = skipSegmentVisible(outro, media.currentTime)
  const playerPortalContainer = playerElement
  const mediaLoading = loading || media.buffering
  const centerIndicatorIcon = mediaLoading
    ? "loading"
    : media.playing
      ? "pause"
      : "play"
  const displayEpisodeTitle = episodeTitle(playback.episode)

  return (
    <PlayerShell
      ref={playerRef}
      className={cn(!controlsVisible && media.playing && "cursor-none")}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
    >
      <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
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

        <div
          className={cn(
            "pointer-events-none absolute top-1/2 left-1/2 z-10 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white shadow-2xl ring-1 ring-white/15 backdrop-blur-md transition-opacity duration-200 md:size-24 [&_svg]:size-9 md:[&_svg]:size-11",
            media.playing && !controlsVisible && !mediaLoading && "opacity-0"
          )}
        >
          {centerIndicatorIcon === "loading" ? (
            <Loader2 className="animate-spin" />
          ) : centerIndicatorIcon === "play" ? (
            <Play />
          ) : (
            <Pause />
          )}
        </div>

        {loading ? (
          <div className="pointer-events-none absolute top-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/75 px-4 py-2 text-sm text-white shadow-2xl backdrop-blur-md">
            <Loader2 className="size-4 animate-spin" />
            Loading stream server…
          </div>
        ) : null}

        {activeSubtitle ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-6 z-10 mx-auto max-w-5xl text-center text-xl font-semibold text-white transition-[bottom] duration-200 md:text-2xl",
              controlsVisible ? "bottom-36 md:bottom-40" : "bottom-10"
            )}
          >
            <span
              className="rounded-lg box-decoration-clone px-2.5 py-1 leading-relaxed"
              style={subtitleStyle(preferences)}
              dangerouslySetInnerHTML={{ __html: activeSubtitle }}
            />
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-4 bottom-32 z-30 flex flex-wrap justify-center gap-2 md:bottom-36">
          {showIntroSkip && intro ? (
            <Button
              className="pointer-events-auto border border-white/35 bg-black/70 text-white shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur-md hover:border-white hover:bg-white hover:text-black"
              variant="secondary"
              size="sm"
              onClick={() => media.skipTo(skipTarget(intro, media.duration))}
            >
              <SkipForward data-icon="inline-start" />
              Skip intro
            </Button>
          ) : null}
          {showOutroSkip && outro ? (
            <Button
              className="pointer-events-auto border border-white/35 bg-black/70 text-white shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur-md hover:border-white hover:bg-white hover:text-black"
              variant="secondary"
              size="sm"
              onClick={() => media.skipTo(skipTarget(outro, media.duration))}
            >
              <SkipForward data-icon="inline-start" />
              Skip outro
            </Button>
          ) : null}
        </div>

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black via-black/75 to-transparent p-3 transition-opacity duration-200 sm:gap-3 sm:p-4",
            controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            >
              <a href={seriesEpisodesHref(playback.anime.malId)}>
                <ArrowLeft />
                <span className="sr-only">Back to series</span>
              </a>
            </Button>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={media.togglePlayback}
            >
              <p className="truncate text-sm font-medium text-white">
                <AnimeTitle title={playback.anime.title} />
              </p>
              <p className="truncate text-xs text-white/55">
                {episodeLabel(playback.episode)}
                {displayEpisodeTitle ? ` · ${displayEpisodeTitle}` : ""}
              </p>
            </button>
            <Badge className="hidden border-white/10 bg-white/10 text-white md:inline-flex">
              {providerLabel(playback.provider)}
            </Badge>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => setEpisodesOpen(true)}
            >
              <ListVideo />
              <span className="sr-only">Episodes</span>
            </Button>
          </div>

          <PlayerTimeline
            playback={playback}
            currentTime={media.currentTime}
            duration={media.duration}
            bufferedEnd={media.bufferedEnd}
            onSeek={media.seekTo}
          />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={media.togglePlayback}
              >
                {mediaLoading ? (
                  <Loader2 className="animate-spin" />
                ) : media.playing ? (
                  <Pause />
                ) : (
                  <Play />
                )}
                <span className="sr-only">
                  {mediaLoading ? "Loading" : media.playing ? "Pause" : "Play"}
                </span>
              </Button>
              <div className="group/volume flex items-center gap-1 rounded-full focus-within:bg-white/10 hover:bg-white/10">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white hover:bg-transparent hover:text-white"
                  onClick={media.toggleMute}
                >
                  {media.muted || media.volume === 0 ? (
                    <VolumeX />
                  ) : (
                    <Volume2 />
                  )}
                  <span className="sr-only">
                    {media.muted ? "Unmute" : "Mute"}
                  </span>
                </Button>
                <div className="grid w-0 overflow-hidden opacity-0 transition-[width,opacity] duration-150 group-focus-within/volume:w-24 group-focus-within/volume:opacity-100 group-hover/volume:w-24 group-hover/volume:opacity-100">
                  <input
                    aria-label="Volume"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={media.muted ? 0 : media.volume}
                    onChange={(event) => {
                      media.setVideoVolume(Number(event.currentTarget.value))
                    }}
                    className="h-8 w-24 cursor-pointer accent-white"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PlayerSettingsPopover
                portalContainer={playerPortalContainer}
                playback={playback}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={toggleFullscreen}
              >
                {fullscreen ? <Minimize /> : <Maximize />}
                <span className="sr-only">
                  {fullscreen ? "Exit full screen" : "Full screen"}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </main>

      <EpisodeSheet
        open={episodesOpen}
        onOpenChange={setEpisodesOpen}
        portalContainer={playerPortalContainer}
        playback={playback}
      />
    </PlayerShell>
  )
}
