import {
  Result,
  useAtom,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { useNavigate } from "@tanstack/react-router"
import type {
  StreamAudio,
  StreamEpisode,
  StreamPlayback,
  StreamProviderEpisodes,
  StreamProviderId,
} from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"
import type Hls from "hls.js"
import {
  ArrowLeft,
  Captions,
  Gauge,
  Maximize,
  Minimize,
  Pause,
  Play,
  ListVideo,
  Settings,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react"
import type { PointerEvent, ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { AnimeTitle } from "../anime/anime-title"
import {
  libraryEntryAtom,
  libraryMutationKeys,
  upsertLibraryAtom,
} from "../library/atoms"
import { streamEpisodesAtom, streamPlaybackAtom } from "./atoms"
import {
  playerPreferencesAtom,
  writeStoredPlayerPreferences,
} from "./preferences"
import type { PlayerPreferences } from "./preferences"
import { streamProxyUrl } from "./proxy"
import type { StreamPlaybackInput } from "./streaming.functions"

type QualityLevel = {
  index: number
  label: string
}

type ThumbnailRegion = {
  x: number
  y: number
  width: number
  height: number
}

type ThumbnailImage = {
  url: string
  region: ThumbnailRegion | null
}

type ThumbnailCue = {
  start: number
  end: number
  image: ThumbnailImage
}

const speedOptions = ["0.5", "0.75", "1", "1.25", "1.5", "2"] as const

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00"
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

const providerLabels: Record<StreamProviderId, string> = {
  provider-a: "ProviderA",
}

const providerLabel = (provider: StreamProviderId) => providerLabels[provider]

const audioLabels: Record<StreamAudio, string> = {
  sub: "Sub",
  dub: "Dub",
}

const audioLabel = (audio: StreamAudio) => audioLabels[audio]

const seriesEpisodesHref = (malId: number) => `/series/${malId}`

const watchHref = ({
  malId,
  provider,
  episodeId,
  audio,
}: {
  malId: number
  provider: StreamProviderId
  episodeId: string
  audio: StreamAudio
}) => {
  const search = new URLSearchParams({ audio })
  return `/watch/${malId}/${provider}/${encodeURIComponent(episodeId)}?${search.toString()}`
}

const preferredAudio = (episode: StreamEpisode): StreamAudio | null => {
  if (episode.availableAudio.includes("sub")) return "sub"
  if (episode.availableAudio.includes("dub")) return "dub"
  return null
}

const qualityLabel = (
  level: { height: number; bitrate: number },
  index: number
) => {
  const resolution =
    level.height > 0 ? `${level.height}p` : `Level ${index + 1}`
  const bitrate =
    level.bitrate > 0 ? ` (${Math.round(level.bitrate / 1000)} kbps)` : ""
  return `${resolution}${bitrate}`
}

const defaultCaptionValue = (playback: StreamPlayback) => {
  const defaultIndex = playback.tracks.findIndex((track) => track.default)
  if (defaultIndex >= 0) return String(defaultIndex)
  return playback.audio === "sub" && playback.tracks.length > 0 ? "0" : "off"
}

const timePartSeconds = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const parseTimestamp = (value: string) => {
  const parts = value.trim().split(":")
  if (parts.length === 3) {
    return (
      timePartSeconds(parts[0]) * 3600 +
      timePartSeconds(parts[1]) * 60 +
      timePartSeconds(parts[2])
    )
  }
  if (parts.length === 2) {
    return timePartSeconds(parts[0]) * 60 + timePartSeconds(parts[1])
  }
  return timePartSeconds(value)
}

const parseThumbnailRegion = (value: string): ThumbnailRegion | null => {
  if (!value.startsWith("xywh=")) return null
  const parts = value.slice(5).split(",").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null
  }
  const x = parts[0] ?? 0
  const y = parts[1] ?? 0
  const width = parts[2] ?? 0
  const height = parts[3] ?? 0
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

const parseThumbnailImage = (
  value: string,
  referer: string
): ThumbnailImage => {
  const url = new URL(value)
  const region = parseThumbnailRegion(url.hash.slice(1))
  url.hash = ""
  return {
    url: streamProxyUrl(url.toString(), referer),
    region,
  }
}

const parseThumbnailVtt = (
  text: string,
  file: string,
  referer: string
): Array<ThumbnailCue> => {
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n")
  const cues: Array<ThumbnailCue> = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? ""
    if (!line.includes("-->")) continue

    const [start = "0", end = "0"] = line
      .split("-->")
      .map((value) => value.trim())
    let imageLine = ""
    for (let cueIndex = index + 1; cueIndex < lines.length; cueIndex += 1) {
      const candidate = lines[cueIndex]?.trim() ?? ""
      if (candidate.length === 0) break
      imageLine = candidate
      break
    }
    if (imageLine.length === 0) continue

    const imageUrl = new URL(imageLine, file).toString()
    cues.push({
      start: parseTimestamp(start),
      end: parseTimestamp(end),
      image: parseThumbnailImage(imageUrl, referer),
    })
  }

  return cues
}

const thumbnailForTime = (
  cues: ReadonlyArray<ThumbnailCue>,
  time: number | null
) => {
  if (time === null) return null
  return cues.find((cue) => time >= cue.start && time <= cue.end) ?? null
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
      input.audio
    )
  )
  const playback = Result.match(result, {
    onInitial: () => initial,
    onFailure: () => initial,
    onSuccess: ({ value }) => value,
  })

  return <StreamPlayer playback={playback} />
}

export function StreamPlayerPendingPage() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between gap-3 p-4">
        <Skeleton className="h-9 w-28 bg-white/10" />
        <Skeleton className="h-9 w-24 bg-white/10" />
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <Skeleton className="aspect-video w-full max-w-5xl rounded-2xl bg-white/10" />
      </div>
    </div>
  )
}

function StreamPlayer({ playback }: { playback: StreamPlayback }) {
  const navigate = useNavigate()
  const playerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const controlsTimeoutRef = useRef<number | null>(null)
  const upsertLibrary = useAtomSet(upsertLibraryAtom, { mode: "promise" })
  const [preferences, setPreferences] = useAtom(playerPreferencesAtom)
  const episodesResult = useAtomValue(streamEpisodesAtom(playback.anime.malId))
  const libraryEntryResult = useAtomValue(
    libraryEntryAtom(playback.anime.malId)
  )
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [episodesOpen, setEpisodesOpen] = useState(false)
  const [caption, setCaption] = useState(defaultCaptionValue(playback))
  const [quality, setQuality] = useState("-1")
  const [qualityLevels, setQualityLevels] = useState<Array<QualityLevel>>([])
  const [speed, setSpeed] = useState("1")
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [hoverPercent, setHoverPercent] = useState(0)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [thumbnailCues, setThumbnailCues] = useState<Array<ThumbnailCue>>([])
  const [syncedEpisodeKey, setSyncedEpisodeKey] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const sourceUrl = streamProxyUrl(
    playback.sourceUrl,
    playback.sourceRefererUrl
  )
  const defaultCaption = defaultCaptionValue(playback)
  const thumbnailTrack = playback.thumbnails.at(0) ?? null
  const thumbnailCue = thumbnailForTime(thumbnailCues, hoverTime)
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

  const syncTimeline = () => {
    const video = videoRef.current
    if (!video) return
    setCurrentTime(video.currentTime)
    setDuration(video.duration)
    setBufferedEnd(
      video.buffered.length > 0
        ? video.buffered.end(video.buffered.length - 1)
        : 0
    )
  }

  const clearControlsTimeout = () => {
    if (controlsTimeoutRef.current === null) return
    window.clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = null
  }

  const revealControls = () => {
    clearControlsTimeout()
    setControlsVisible(true)
    if (!playing || settingsOpen || episodesOpen) return
    controlsTimeoutRef.current = window.setTimeout(() => {
      setControlsVisible(false)
    }, 2500)
  }

  const applyCaptionTracks = () => {
    const video = videoRef.current
    if (!video) return
    for (let index = 0; index < video.textTracks.length; index += 1) {
      const textTrack = video.textTracks[index]
      textTrack.mode = caption === String(index) ? "hidden" : "disabled"
    }
  }

  const updatePreferences = (patch: Partial<PlayerPreferences>) => {
    const next = { ...preferences, ...patch }
    setPreferences(next)
    writeStoredPlayerPreferences(next)
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
    if (!preferences.syncLibraryOnFinish || syncedEpisodeKey === episodeKey) {
      return
    }

    const episodeProgress = Math.max(0, Math.floor(playback.episode.number))
    const progress = Math.max(libraryEntry?.progress ?? 0, episodeProgress)
    const totalEpisodes = playback.anime.episodes
    const completed = totalEpisodes !== null && progress >= totalEpisodes
    const status =
      completed || libraryEntry?.status === "completed"
        ? "completed"
        : "watching"

    setSyncedEpisodeKey(episodeKey)

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
        },
        reactivityKeys: libraryMutationKeys(playback.anime.malId),
      })
    } catch {
      toast.error("Log in to sync episode progress to your library.")
    }
  }

  const finishEpisode = () => {
    void syncLibraryProgress()
    if (preferences.autoNext) navigateToEpisode(nextEpisode)
  }

  const seekBy = (seconds: number) => {
    const video = videoRef.current
    if (!video) return
    const nextTime = Math.min(
      Math.max(video.currentTime + seconds, 0),
      video.duration || 0
    )
    video.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const adjustVolume = (delta: number) => {
    const video = videoRef.current
    if (!video) return
    video.volume = Math.min(Math.max(video.volume + delta, 0), 1)
    video.muted = video.volume === 0
    setMuted(video.muted)
  }

  const cycleCaptions = () => {
    if (playback.tracks.length === 0) return
    const current = caption === "off" ? -1 : Number(caption)
    const next =
      current + 1 >= playback.tracks.length ? "off" : String(current + 1)
    setCaption(next)
  }

  const updateHoverPreview = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const percent = Math.min(
      Math.max((event.clientX - rect.left) / rect.width, 0),
      1
    )
    setHoverPercent(percent * 100)
    setHoverTime(duration > 0 ? duration * percent : null)
  }

  useEffect(() => {
    setCaption(defaultCaption)
    setSyncedEpisodeKey(null)
    setHoverTime(null)
    setThumbnailCues([])
  }, [defaultCaption, episodeKey])

  useEffect(() => {
    revealControls()
    return clearControlsTimeout
  }, [episodesOpen, playing, settingsOpen])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let disposed = false
    let attachedHls: Hls | null = null

    setPlayerError(null)
    setQuality("-1")
    setQualityLevels([])

    void import("hls.js")
      .then((module) => {
        if (disposed) return

        const HlsPlayer = module.default
        if (HlsPlayer.isSupported()) {
          const hls = new HlsPlayer()
          attachedHls = hls
          hlsRef.current = hls
          hls.loadSource(sourceUrl)
          hls.attachMedia(video)
          hls.on(HlsPlayer.Events.MANIFEST_PARSED, () => {
            if (disposed) return
            setQualityLevels(
              hls.levels.map((level, index) => ({
                index,
                label: qualityLabel(level, index),
              }))
            )
          })
          hls.on(HlsPlayer.Events.ERROR, (_event, data) => {
            if (!disposed && data.fatal) {
              setPlayerError(
                "The stream failed to load. Try another episode or audio track."
              )
            }
          })
          return
        }

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = sourceUrl
          return
        }

        setPlayerError("This browser cannot play the selected stream format.")
      })
      .catch(() => {
        if (!disposed) {
          setPlayerError(
            "The stream player could not be loaded. Try refreshing the page."
          )
        }
      })

    return () => {
      disposed = true
      attachedHls?.destroy()
      if (hlsRef.current === attachedHls) {
        hlsRef.current = null
      }
      video.pause()
      video.removeAttribute("src")
      video.load()
    }
  }, [sourceUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = Number(speed)
  }, [speed])

  useEffect(() => {
    const hls = hlsRef.current
    if (!hls) return
    hls.currentLevel = Number(quality)
  }, [quality])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const timeout = window.setTimeout(applyCaptionTracks)
    applyCaptionTracks()
    return () => window.clearTimeout(timeout)
  }, [caption, playback.tracks])

  useEffect(() => {
    if (caption === "off") {
      setActiveSubtitle(null)
      return
    }
    const video = videoRef.current
    const textTrack = video?.textTracks[Number(caption)] ?? null
    if (!textTrack) {
      setActiveSubtitle(null)
      return
    }

    const updateActiveSubtitle = () => {
      const cues = Array.from(textTrack.activeCues ?? [])
        .map((cue) => (cue instanceof VTTCue ? cue.text : ""))
        .filter((text) => text.length > 0)
      setActiveSubtitle(cues.length > 0 ? cues.join("\n") : null)
    }

    updateActiveSubtitle()
    textTrack.addEventListener("cuechange", updateActiveSubtitle)
    return () =>
      textTrack.removeEventListener("cuechange", updateActiveSubtitle)
  }, [caption, playback.tracks])

  useEffect(() => {
    if (!preferences.autoplay) return
    const video = videoRef.current
    if (!video) return
    const play = () => {
      void video.play().catch(() => undefined)
    }
    video.addEventListener("canplay", play, { once: true })
    return () => video.removeEventListener("canplay", play)
  }, [preferences.autoplay, sourceUrl])

  useEffect(() => {
    if (!thumbnailTrack) {
      setThumbnailCues([])
      return
    }

    let disposed = false
    const thumbnailUrl = streamProxyUrl(
      thumbnailTrack.file,
      playback.sourceRefererUrl
    )
    void fetch(thumbnailUrl)
      .then((response) => (response.ok ? response.text() : ""))
      .then((text) => {
        if (disposed) return
        setThumbnailCues(
          parseThumbnailVtt(
            text,
            thumbnailTrack.file,
            playback.sourceRefererUrl
          )
        )
      })
      .catch(() => {
        if (!disposed) setThumbnailCues([])
      })

    return () => {
      disposed = true
    }
  }, [playback.sourceRefererUrl, thumbnailTrack])

  const skipTo = (seconds: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = seconds
    void video.play()
  }

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play()
      return
    }
    video.pause()
  }

  const seekTo = (value: string) => {
    const video = videoRef.current
    if (!video) return
    const nextTime = Number(value)
    video.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
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
    const onFullscreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target
      const editing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      if (editing || event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === " " || event.key.toLowerCase() === "k") {
        event.preventDefault()
        togglePlayback()
        revealControls()
        return
      }
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "j") {
        event.preventDefault()
        seekBy(-10)
        revealControls()
        return
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "l") {
        event.preventDefault()
        seekBy(10)
        revealControls()
        return
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        adjustVolume(0.05)
        revealControls()
        return
      }
      if (event.key === "ArrowDown") {
        event.preventDefault()
        adjustVolume(-0.05)
        revealControls()
        return
      }
      if (event.key.toLowerCase() === "m") {
        event.preventDefault()
        toggleMute()
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

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0
  const intro = playback.intro
  const outro = playback.outro

  return (
    <div
      ref={playerRef}
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-black text-white",
        !controlsVisible && playing && "cursor-none"
      )}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
    >
      <style>{`
        .kaiser-stream-video::cue {
          color: white;
          background: rgba(0, 0, 0, 0.72);
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.95), 0 0 8px rgba(0, 0, 0, 0.9);
          font-size: 1.15rem;
          line-height: 1.35;
        }
      `}</style>
      <header
        className={cn(
          "flex items-center justify-between gap-3 border-b border-white/10 bg-black/80 px-3 py-2 backdrop-blur transition-opacity duration-200 md:px-4",
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <a href={seriesEpisodesHref(playback.anime.malId)}>
              <ArrowLeft />
              <span className="sr-only">Back to series</span>
            </a>
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium md:text-base">
              <AnimeTitle title={playback.anime.title} />
            </p>
            <p className="truncate text-xs text-white/50">
              Episode {playback.episode.number} · {playback.episode.title}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge className="hidden border-white/10 bg-white/10 text-white sm:inline-flex">
            {providerLabel(playback.provider)}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={() => setEpisodesOpen(true)}
          >
            <ListVideo data-icon="inline-start" />
            Episodes
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings />
            <span className="sr-only">Player settings</span>
          </Button>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center bg-black">
        <video
          ref={videoRef}
          className="kaiser-stream-video size-full max-h-full max-w-full bg-black"
          playsInline
          crossOrigin="anonymous"
          onClick={togglePlayback}
          onLoadedMetadata={() => {
            syncTimeline()
            applyCaptionTracks()
          }}
          onDurationChange={syncTimeline}
          onTimeUpdate={syncTimeline}
          onProgress={syncTimeline}
          onEnded={finishEpisode}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        >
          {playback.tracks.map((track, index) => (
            <track
              key={`${track.file}-${index}`}
              src={streamProxyUrl(track.file, playback.sourceRefererUrl)}
              label={track.label}
              kind={track.kind}
              default={track.default}
            />
          ))}
        </video>

        {activeSubtitle ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-6 z-10 mx-auto max-w-5xl text-center text-xl font-semibold text-white transition-[bottom] duration-200 md:text-2xl",
              controlsVisible ? "bottom-36 md:bottom-40" : "bottom-10"
            )}
          >
            <span className="rounded-lg bg-black/75 box-decoration-clone px-2.5 py-1 leading-relaxed whitespace-pre-line shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              {activeSubtitle}
            </span>
          </div>
        ) : null}

        {playerError ? (
          <div className="absolute inset-x-4 top-4 rounded-2xl border border-white/10 bg-black/80 p-4 text-sm text-white shadow-xl md:inset-x-auto md:right-4 md:w-96">
            {playerError}
          </div>
        ) : null}

        <div
          className={cn(
            "pointer-events-none absolute inset-x-4 bottom-20 flex flex-wrap justify-center gap-2 transition-opacity duration-200 md:bottom-24",
            controlsVisible ? "opacity-100" : "opacity-0"
          )}
        >
          {intro ? (
            <Button
              className="pointer-events-auto bg-white/15 text-white backdrop-blur hover:bg-white/25"
              variant="secondary"
              size="sm"
              onClick={() => skipTo(intro.end)}
            >
              <SkipForward data-icon="inline-start" />
              Skip intro
            </Button>
          ) : null}
          {outro ? (
            <Button
              className="pointer-events-auto bg-white/15 text-white backdrop-blur hover:bg-white/25"
              variant="secondary"
              size="sm"
              onClick={() => skipTo(outro.end)}
            >
              <SkipForward data-icon="inline-start" />
              Skip outro
            </Button>
          ) : null}
        </div>

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black via-black/70 to-transparent p-4 transition-opacity duration-200",
            controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <div className="flex items-center gap-3 text-xs text-white/70">
            <span className="w-12 tabular-nums">{formatTime(currentTime)}</span>
            <div
              className="relative h-5 flex-1"
              onPointerMove={updateHoverPreview}
              onPointerLeave={() => setHoverTime(null)}
            >
              {thumbnailCue ? (
                <div
                  className="pointer-events-none absolute bottom-8 z-10 -translate-x-1/2 rounded-xl border border-white/10 bg-black/90 p-1 shadow-2xl"
                  style={{ left: `${hoverPercent}%` }}
                >
                  <ThumbnailPreview image={thumbnailCue.image} />
                  <p className="mt-1 text-center text-[11px] text-white/70">
                    {formatTime(hoverTime ?? 0)}
                  </p>
                </div>
              ) : null}
              <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/15" />
              <div
                className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25"
                style={{ width: `${Math.min(bufferedPercent, 100)}%` }}
              />
              <div
                className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
              <input
                aria-label="Seek"
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(event) => seekTo(event.currentTarget.value)}
                className="absolute inset-0 h-5 w-full cursor-pointer opacity-0"
              />
            </div>
            <span className="w-12 text-right tabular-nums">
              {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={togglePlayback}
              >
                {playing ? <Pause /> : <Play />}
                <span className="sr-only">{playing ? "Pause" : "Play"}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={toggleMute}
              >
                {muted ? <VolumeX /> : <Volume2 />}
                <span className="sr-only">{muted ? "Unmute" : "Mute"}</span>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings />
                <span className="sr-only">Player settings</span>
              </Button>
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

      <PlayerSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        playback={playback}
        caption={caption}
        onCaptionChange={setCaption}
        quality={quality}
        onQualityChange={setQuality}
        qualityLevels={qualityLevels}
        speed={speed}
        onSpeedChange={setSpeed}
        preferences={preferences}
        onPreferencesChange={updatePreferences}
      />
      <EpisodeSheet
        open={episodesOpen}
        onOpenChange={setEpisodesOpen}
        playback={playback}
      />
    </div>
  )
}

function PlayerSettingsDialog({
  open,
  onOpenChange,
  playback,
  caption,
  onCaptionChange,
  quality,
  onQualityChange,
  qualityLevels,
  speed,
  onSpeedChange,
  preferences,
  onPreferencesChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  playback: StreamPlayback
  caption: string
  onCaptionChange: (caption: string) => void
  quality: string
  onQualityChange: (quality: string) => void
  qualityLevels: ReadonlyArray<QualityLevel>
  speed: string
  onSpeedChange: (speed: string) => void
  preferences: PlayerPreferences
  onPreferencesChange: (patch: Partial<PlayerPreferences>) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Player settings</DialogTitle>
          <DialogDescription>
            Adjust captions, stream quality, audio track, and playback speed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <SettingSelect
            icon={<Captions />}
            label="Captions"
            value={caption}
            onValueChange={onCaptionChange}
            placeholder="Captions"
          >
            <SelectGroup>
              <SelectLabel>Captions</SelectLabel>
              <SelectItem value="off">Off</SelectItem>
              {playback.tracks.map((track, index) => (
                <SelectItem
                  key={`${track.file}-${index}`}
                  value={String(index)}
                >
                  {track.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SettingSelect>

          <SettingSelect
            icon={<Gauge />}
            label="Quality"
            value={quality}
            onValueChange={onQualityChange}
            placeholder="Quality"
          >
            <SelectGroup>
              <SelectLabel>Quality</SelectLabel>
              <SelectItem value="-1">Auto</SelectItem>
              {qualityLevels.map((level) => (
                <SelectItem key={level.index} value={String(level.index)}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SettingSelect>

          <SettingSelect
            label="Speed"
            value={speed}
            onValueChange={onSpeedChange}
            placeholder="Speed"
          >
            <SelectGroup>
              <SelectLabel>Playback speed</SelectLabel>
              {speedOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}×
                </SelectItem>
              ))}
            </SelectGroup>
          </SettingSelect>

          <PlayerPreferenceSwitch
            label="Autoplay"
            description="Start playback automatically when the stream is ready."
            checked={preferences.autoplay}
            onCheckedChange={(checked) =>
              onPreferencesChange({ autoplay: checked })
            }
          />

          <PlayerPreferenceSwitch
            label="Auto next"
            description="Move to the next available episode when this one ends."
            checked={preferences.autoNext}
            onCheckedChange={(checked) =>
              onPreferencesChange({ autoNext: checked })
            }
          />

          <PlayerPreferenceSwitch
            label="Sync library progress"
            description="Update your library progress after an episode finishes."
            checked={preferences.syncLibraryOnFinish}
            onCheckedChange={(checked) =>
              onPreferencesChange({ syncLibraryOnFinish: checked })
            }
          />

          <div className="rounded-2xl border p-3">
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Audio
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {playback.episode.availableAudio.map((audio) => (
                <Button
                  key={audio}
                  asChild
                  variant={audio === playback.audio ? "default" : "outline"}
                  size="sm"
                >
                  <a
                    href={watchHref({
                      malId: playback.anime.malId,
                      provider: playback.provider,
                      episodeId: playback.episode.id,
                      audio,
                    })}
                  >
                    {audioLabel(audio)}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SettingSelect({
  icon,
  label,
  value,
  onValueChange,
  placeholder,
  children,
}: {
  icon?: ReactNode
  label: string
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border p-3">
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <p className="text-sm font-medium">{label}</p>
      </div>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  )
}

function PlayerPreferenceSwitch({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function ThumbnailPreview({ image }: { image: ThumbnailImage }) {
  if (!image.region) {
    return (
      <img
        className="aspect-video w-40 rounded-lg object-cover"
        src={image.url}
        alt="Seek preview"
      />
    )
  }

  const width = 160
  const scale = width / image.region.width
  const height = image.region.height * scale

  return (
    <div
      className="overflow-hidden rounded-lg bg-black"
      style={{ width, height }}
    >
      <img
        src={image.url}
        alt="Seek preview"
        className="max-w-none origin-top-left"
        style={{
          transform: `translate(-${image.region.x * scale}px, -${
            image.region.y * scale
          }px) scale(${scale})`,
        }}
      />
    </div>
  )
}

function EpisodeSheet({
  open,
  onOpenChange,
  playback,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  playback: StreamPlayback
}) {
  const result = useAtomValue(streamEpisodesAtom(playback.anime.malId))
  const catalog = Result.match(result, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  })
  const playbackProvider: string = playback.provider
  const provider =
    catalog?.providers.find((item) => item.provider === playbackProvider) ??
    null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(92vw,28rem)] bg-background" side="right">
        <SheetHeader>
          <SheetTitle>Episodes</SheetTitle>
          <SheetDescription>
            {providerLabel(playback.provider)} episodes for{" "}
            <AnimeTitle title={playback.anime.title} />.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-6 pb-6">
          {provider ? (
            <EpisodeSheetList
              provider={provider}
              playback={playback}
              onSelect={() => onOpenChange(false)}
            />
          ) : (
            <EpisodeSheetPending />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function EpisodeSheetList({
  provider,
  playback,
  onSelect,
}: {
  provider: StreamProviderEpisodes
  playback: StreamPlayback
  onSelect: () => void
}) {
  if (provider.status !== "available") {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        {provider.message ?? "This provider is unavailable."}
      </div>
    )
  }

  return provider.episodes.map((episode) => {
    const audio = preferredAudio(episode)
    const isCurrent = episode.id === playback.episode.id
    return (
      <Button
        key={episode.id}
        asChild
        variant={isCurrent ? "default" : "outline"}
        className={cn(
          "h-auto justify-start rounded-2xl px-3 py-3",
          !audio && "opacity-60"
        )}
        disabled={!audio}
      >
        <a
          href={watchHref({
            malId: playback.anime.malId,
            provider: playback.provider,
            episodeId: episode.id,
            audio: audio ?? playback.audio,
          })}
          onClick={onSelect}
        >
          <span className="flex min-w-0 flex-col items-start text-left">
            <span className="text-xs opacity-70">Episode {episode.number}</span>
            <span className="line-clamp-1">{episode.title}</span>
          </span>
        </a>
      </Button>
    )
  })
}

function EpisodeSheetPending() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-14 rounded-2xl" />
      ))}
    </>
  )
}
