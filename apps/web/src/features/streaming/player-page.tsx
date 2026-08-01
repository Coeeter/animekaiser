import type {
  StreamAudio,
  StreamEpisode,
  StreamPlayback,
  StreamProviderId,
} from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { useSidebar } from "@animekaiser/ui/components/sidebar"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { useIsMobile } from "@animekaiser/ui/hooks/use-mobile"
import { cn } from "@animekaiser/ui/lib/utils"
import {
  Result,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeft,
  ListVideo,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Server,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import type { ComponentPropsWithoutRef, MouseEvent, PointerEvent } from "react"
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { DataError } from "../../components/data-error"
import { AnimeTitle } from "../anime/common/anime-title"
import { useResumePlayback } from "../history/use-resume-playback"
import { useWatchProgress } from "../history/use-watch-progress"
import {
  libraryEntryAtom,
  libraryMutationKeys,
  upsertLibraryAtom,
} from "../library/atoms"
import { streamEpisodesAtom, streamPlaybackAtom } from "./atoms"
import {
  clampMiniPlayerFrame,
  type MiniPlayerFrame,
  miniPlayerFrameAtom,
  miniPlayerMinHeight,
  miniPlayerMinWidth,
  setMiniPlayerFrameAtom,
} from "./mini-player-frame"
import { EpisodeSheet } from "./player-episode-sheet"
import {
  episodeLabel,
  episodeTitle,
  nextStreamServer,
  preferredAudio,
  providerLabel,
  videoFitClass,
} from "./player-format"
import { PlayerMobilePanel } from "./player-mobile-panel"
import { ServerSheet } from "./player-server-sheet"
import { PlayerSettingsPopover } from "./player-settings-popover"
import { PlayerTimeline } from "./player-timeline"
import {
  playerCaptionAtom,
  playerUiAtom,
  updatePlayerUiAtom,
} from "./player-ui-state"
import { playerPreferencesAtom } from "./preferences"
import { streamProxyUrl } from "./proxy"
import { subtitleStyle } from "./subtitle-settings"
import type { SubtitleCue } from "./subtitles"
import { parseSubtitleVtt, subtitleHtmlAtTime } from "./subtitles"
import { usePlayerMedia } from "./use-player-media"

const PlayerShell = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div"> & {
    variant?: "full" | "mini"
    sidebarState?: "expanded" | "collapsed"
  }
>(
  (
    { className, variant = "full", sidebarState = "collapsed", ...props },
    ref
  ) => (
    <div
      ref={ref}
      data-sidebar-state={sidebarState}
      className={cn(
        "flex flex-col bg-black text-white",
        variant === "full" && [
          "w-full",
          "md:fixed md:inset-0 md:z-50 md:h-dvh md:w-auto md:left-[var(--sidebar-width-icon)]",
          "md:transition-[left] md:duration-150 md:ease-in-out md:data-[sidebar-state=expanded]:left-[var(--sidebar-width)]",
          "[&:fullscreen]:fixed [&:fullscreen]:inset-0 [&:fullscreen]:left-0 [&:fullscreen]:z-50 [&:fullscreen]:h-dvh [&:fullscreen]:w-dvw",
        ],
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

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>
}

const lockLandscape = () => {
  const orientation: LockableOrientation | undefined = window.screen.orientation

  void orientation?.lock?.("landscape").catch(() => undefined)
}

const unlockOrientation = () => {
  window.screen.orientation?.unlock?.()
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

type MiniResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw"

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

const miniPlayerFrameProperties = [
  "left",
  "top",
  "right",
  "bottom",
  "width",
  "height",
] as const

const applyMiniPlayerFrame = (
  player: HTMLElement,
  frame: MiniPlayerFrame
): void => {
  player.style.left = `${frame.left}px`
  player.style.top = `${frame.top}px`
  player.style.width = `${frame.width}px`
  player.style.height = `${frame.height}px`
  player.style.right = "auto"
  player.style.bottom = "auto"
}

export function StreamPlayerPendingPage({
  mode = "full",
}: {
  mode?: "full" | "mini"
}) {
  return (
    <PlayerShell
      variant={mode}
      className={mode === "mini" ? miniPlayerClass : undefined}
    >
      <div className="relative aspect-video w-full shrink-0 md:aspect-auto md:min-h-0 md:flex-1">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/5">
          <Loader2 className="size-6 animate-spin text-white/70" />
          <p className="text-sm text-white/70">Loading stream…</p>
        </div>
      </div>
      {mode === "full" ? (
        <div className="flex flex-col gap-4 bg-background p-4 md:hidden">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-11 rounded-2xl" />
            <Skeleton className="h-11 rounded-2xl" />
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : null}
    </PlayerShell>
  )
}

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
  const navigate = useNavigate()
  const { state: sidebarState } = useSidebar()
  const isMobile = useIsMobile()

  const playerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<number | null>(null)

  const upsertLibrary = useAtomSet(upsertLibraryAtom, { mode: "promise" })

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

  const setEpisodesOpen = (open: boolean) =>
    updatePlayerUi({ episodesOpen: open })

  const [controlsVisible, setControlsVisible] = useState(true)
  const [serversOpen, setServersOpen] = useState(false)
  const controlsVisibleRef = useRef(controlsVisible)

  const videoPointerRef = useRef<{
    controlsWereVisible: boolean
    pointerType: string
  } | null>(null)

  const [subtitleCues, setSubtitleCues] = useState<Array<SubtitleCue>>([])
  const [syncedEpisodeKey, setSyncedEpisodeKey] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [playerElement, setPlayerElement] = useState<HTMLElement | null>(null)
  const miniInteractionRef = useRef<{
    kind: "drag" | "resize"
    direction?: MiniResizeDirection
    pointerId: number
    x: number
    y: number
    bounds: DOMRect
    moved: boolean
  } | null>(null)
  const suppressVideoClickRef = useRef(false)

  const sourceUrl = streamProxyUrl(
    playback.sourceUrl,
    playback.sourceRefererUrl
  )

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

  const { flushWatchProgress } = useWatchProgress({
    playback,
    currentTime: media.currentTime,
    duration: media.duration,
    playing: media.playing,
  })

  useResumePlayback({ playback, videoRef: media.videoRef })

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

  const clearControlsTimeout = () => {
    if (controlsTimeoutRef.current === null) return

    window.clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = null
  }

  const hideControls = () => {
    clearControlsTimeout()
    controlsVisibleRef.current = false
    setControlsVisible(false)
  }

  const revealControls = () => {
    clearControlsTimeout()

    controlsVisibleRef.current = true
    setControlsVisible(true)

    if (!media.playing || settingsOpen || episodesOpen || serversOpen) return

    controlsTimeoutRef.current = window.setTimeout(() => {
      controlsVisibleRef.current = false
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
    flushWatchProgress()
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

  const toggleFullscreen = () => {
    const player = playerRef.current
    if (!player) return

    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }

    void player.requestFullscreen().then(lockLandscape, () => undefined)
  }

  const beginMiniPlayerInteraction = (event: PointerEvent<HTMLDivElement>) => {
    if (mode !== "mini" || !playerRef.current || event.button !== 0) return
    if ((event.target as HTMLElement).closest("button, a, input")) return

    const resizeHandle = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-mini-resize]"
    )
    miniInteractionRef.current = {
      kind: resizeHandle ? "resize" : "drag",
      direction: resizeHandle?.dataset.miniResize as
        | MiniResizeDirection
        | undefined,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      bounds: playerRef.current.getBoundingClientRect(),
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveMiniPlayer = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = miniInteractionRef.current
    const player = playerRef.current
    if (!interaction || !player || interaction.pointerId !== event.pointerId)
      return

    const dx = event.clientX - interaction.x
    const dy = event.clientY - interaction.y
    if (Math.abs(dx) + Math.abs(dy) > 3) interaction.moved = true
    if (!interaction.moved) return

    const bounds = interaction.bounds
    let left = bounds.left
    let top = bounds.top
    let width = bounds.width
    let height = bounds.height

    if (interaction.kind === "drag") {
      left = Math.min(
        Math.max(0, bounds.left + dx),
        window.innerWidth - bounds.width
      )
      top = Math.min(
        Math.max(0, bounds.top + dy),
        window.innerHeight - bounds.height
      )
    } else {
      const direction = interaction.direction ?? "se"
      if (direction.includes("e"))
        width = Math.min(
          Math.max(miniPlayerMinWidth, bounds.width + dx),
          window.innerWidth - bounds.left
        )
      if (direction.includes("s"))
        height = Math.min(
          Math.max(miniPlayerMinHeight, bounds.height + dy),
          window.innerHeight - bounds.top
        )
      if (direction.includes("w")) {
        width = Math.min(
          Math.max(miniPlayerMinWidth, bounds.width - dx),
          bounds.right
        )
        left = bounds.right - width
      }
      if (direction.includes("n")) {
        height = Math.min(
          Math.max(miniPlayerMinHeight, bounds.height - dy),
          bounds.bottom
        )
        top = bounds.bottom - height
      }
    }

    applyMiniPlayerFrame(player, { left, top, width, height })
  }

  const endMiniPlayerInteraction = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = miniInteractionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return
    suppressVideoClickRef.current =
      interaction.kind === "drag" && interaction.moved
    miniInteractionRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)

    if (!interaction.moved || !playerRef.current) return

    const { left, top, width, height } =
      playerRef.current.getBoundingClientRect()
    setMiniPlayerFrame({ left, top, width, height })
  }

  useLayoutEffect(() => {
    const player = playerRef.current
    if (!player) return

    if (mode === "full") {
      for (const property of miniPlayerFrameProperties)
        player.style.removeProperty(property)
      return
    }

    if (!miniPlayerFrame) return

    const restore = () =>
      applyMiniPlayerFrame(
        player,
        clampMiniPlayerFrame(miniPlayerFrame, {
          width: window.innerWidth,
          height: window.innerHeight,
        })
      )

    restore()
    window.addEventListener("resize", restore)
    return () => window.removeEventListener("resize", restore)
  }, [mode, miniPlayerFrame])

  useEffect(() => {
    setPlayerElement(playerRef.current)
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => {
      const isFullscreen = Boolean(document.fullscreenElement)
      setFullscreen(isFullscreen)
      if (!isFullscreen) unlockOrientation()
    }

    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      unlockOrientation()
    }
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
      variant={mode}
      sidebarState={sidebarState}
      className={cn(
        mode === "mini" && miniPlayerClass,
        mode === "full" && !controlsVisible && media.playing && "cursor-none"
      )}
      onPointerMove={moveMiniPlayer}
      onPointerDown={beginMiniPlayerInteraction}
      onPointerUp={endMiniPlayerInteraction}
      onPointerCancel={endMiniPlayerInteraction}
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
          <div
            className={cn(
              "pointer-events-none absolute top-1/2 left-1/2 z-10 hidden size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white shadow-2xl ring-1 ring-white/15 backdrop-blur-md transition-opacity duration-200 md:grid md:size-24 [&_svg]:size-9 md:[&_svg]:size-11",
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
        ) : null}

        {loading ? (
          <div className="pointer-events-none absolute top-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/75 px-4 py-2 text-sm text-white shadow-2xl backdrop-blur-md">
            <Loader2 className="size-4 animate-spin" />
            Loading stream server…
          </div>
        ) : null}

        {activeSubtitle ? (
          <div
            className={cn(
              "pointer-events-none absolute z-20 mx-auto text-center font-semibold text-white transition-[bottom] duration-200",
              mode === "full"
                ? cn(
                    "inset-x-4 max-w-5xl text-sm sm:text-lg md:inset-x-6 md:text-2xl",
                    controlsVisible
                      ? "bottom-12 md:bottom-40"
                      : "bottom-4 md:bottom-10"
                  )
                : "inset-x-3 bottom-3 line-clamp-2 text-xs"
            )}
          >
            <span
              className={cn(
                "rounded-lg box-decoration-clone leading-relaxed",
                mode === "full" ? "px-2.5 py-1" : "px-1.5 py-0.5"
              )}
              style={subtitleStyle(preferences)}
              dangerouslySetInnerHTML={{ __html: activeSubtitle }}
            />
          </div>
        ) : null}

        {mode === "full" ? (
          <div className="pointer-events-none absolute inset-x-4 bottom-14 z-30 flex flex-wrap justify-center gap-2 md:bottom-36">
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
        ) : null}

        {mode === "full" ? (
          <>
            <div
              className={cn(
                "absolute inset-x-0 top-0 z-30 flex items-center gap-1 bg-gradient-to-b from-black/85 to-transparent p-2 pb-6 transition-opacity duration-200 md:hidden",
                controlsVisible
                  ? "opacity-100"
                  : "pointer-events-none opacity-0"
              )}
            >
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="shrink-0 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/series/$id" params={{ id: playback.anime.malId }}>
                  <ArrowLeft />
                  <span className="sr-only">Back to series</span>
                </Link>
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  <AnimeTitle title={playback.anime.title} />
                </p>
                <p className="truncate text-xs text-white/55">
                  {episodeLabel(playback.episode)}
                </p>
              </div>
              {isMobile ? (
                <PlayerSettingsPopover
                  portalContainer={playerPortalContainer}
                  playback={playback}
                />
              ) : null}
            </div>

            <div
              className={cn(
                "absolute inset-0 z-20 flex items-center justify-center gap-6 transition-opacity duration-200 md:hidden",
                controlsVisible
                  ? "opacity-100"
                  : "pointer-events-none opacity-0"
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-12 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white [&_svg]:size-6"
                onClick={() => media.seekBy(-10)}
              >
                <RotateCcw />
                <span className="sr-only">Back 10 seconds</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-16 rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white [&_svg]:size-8"
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
                  {media.playing ? "Pause" : "Play"}
                </span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-12 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white [&_svg]:size-6"
                onClick={() => media.seekBy(10)}
              >
                <RotateCw />
                <span className="sr-only">Forward 10 seconds</span>
              </Button>
            </div>

            <div
              className={cn(
                "absolute inset-x-0 bottom-0 z-30 flex items-center gap-2 bg-gradient-to-t from-black via-black/70 to-transparent px-2 pt-8 pb-1 transition-opacity duration-200 md:hidden",
                controlsVisible
                  ? "opacity-100"
                  : "pointer-events-none opacity-0"
              )}
            >
              <div className="min-w-0 flex-1">
                <PlayerTimeline
                  playback={playback}
                  currentTime={media.currentTime}
                  duration={media.duration}
                  bufferedEnd={media.bufferedEnd}
                  onSeek={media.seekTo}
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-white hover:bg-white/10 hover:text-white"
                onClick={toggleFullscreen}
              >
                {fullscreen ? <Minimize /> : <Maximize />}
                <span className="sr-only">
                  {fullscreen ? "Exit full screen" : "Full screen"}
                </span>
              </Button>
            </div>

            <div
              className={cn(
                "absolute inset-x-0 bottom-0 z-20 hidden flex-col gap-2 bg-gradient-to-t from-black via-black/75 to-transparent p-3 transition-opacity duration-200 sm:gap-3 sm:p-4 md:flex",
                controlsVisible
                  ? "opacity-100"
                  : "pointer-events-none opacity-0"
              )}
            >
              <div className="flex items-center gap-2">
                <Button
                  asChild
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link to="/series/$id" params={{ id: playback.anime.malId }}>
                    <ArrowLeft />
                    <span className="sr-only">Back to series</span>
                  </Link>
                </Button>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={media.togglePlayback}
                >
                  <p className="truncate text-sm font-medium text-white">
                    <AnimeTitle title={playback.anime.title} />
                  </p>
                  <p
                    className="truncate text-xs text-white/55"
                    title={`${episodeLabel(playback.episode)}${displayEpisodeTitle ? ` · ${displayEpisodeTitle}` : ""}`}
                  >
                    {episodeLabel(playback.episode)}
                    {displayEpisodeTitle ? ` · ${displayEpisodeTitle}` : ""}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="max-w-44 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => setEpisodesOpen(true)}
                >
                  <ListVideo />
                  <span
                    className="truncate"
                    title={`${providerLabel(playback.provider)} episodes`}
                  >
                    {providerLabel(playback.provider)} episodes
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="max-w-40 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => setServersOpen(true)}
                >
                  <Server />
                  <span className="truncate" title={playback.server.name}>
                    {playback.server.name}
                  </span>
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
                      {mediaLoading
                        ? "Loading"
                        : media.playing
                          ? "Pause"
                          : "Play"}
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
                          media.setVideoVolume(
                            Number(event.currentTarget.value)
                          )
                        }}
                        className="h-8 w-24 cursor-pointer accent-white"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isMobile ? null : (
                    <PlayerSettingsPopover
                      portalContainer={playerPortalContainer}
                      playback={playback}
                    />
                  )}
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
          </>
        ) : (
          <>
            <div className="absolute top-2 right-2 z-50 flex cursor-default items-center gap-1 opacity-0 transition-opacity group-hover/miniplayer:opacity-100 focus-within:opacity-100">
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                className="bg-black/45 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white"
              >
                <Link
                  to="/watch/$malId/$provider/$episodeId"
                  params={{
                    malId: playback.anime.malId,
                    provider: playback.provider,
                    episodeId: playback.episode.id,
                  }}
                  search={{ audio: playback.audio, serverId: input.serverId }}
                >
                  <Maximize />
                  <span className="sr-only">Return to full player</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="bg-black/45 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white"
                onClick={onClose}
              >
                <X />
                <span className="sr-only">Close player</span>
              </Button>
            </div>
            <div className="absolute inset-0 z-30 flex cursor-default items-center justify-center gap-2 bg-black/20 opacity-0 transition-opacity group-hover/miniplayer:opacity-100 focus-within:opacity-100">
              <Button
                variant="ghost"
                size="icon-sm"
                className="bg-black/45 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white"
                onClick={() => media.seekBy(-5)}
              >
                <RotateCcw />
                <span className="sr-only">Back 5 seconds</span>
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full bg-white text-black hover:bg-white/85"
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
                  {media.playing ? "Pause" : "Play"}
                </span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="bg-black/45 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white"
                onClick={() => media.seekBy(5)}
              >
                <RotateCw />
                <span className="sr-only">Forward 5 seconds</span>
              </Button>
            </div>
          </>
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
