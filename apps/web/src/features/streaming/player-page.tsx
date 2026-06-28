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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Input } from "@workspace/ui/components/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Switch } from "@workspace/ui/components/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import type Hls from "hls.js"
import {
  ArrowLeft,
  ArrowDownUp,
  Captions,
  ChevronLeft,
  ChevronRight,
  Check,
  Gauge,
  Maximize,
  Minimize,
  Pause,
  Play,
  ListVideo,
  Settings,
  Search,
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
import type { PlayerPreferences, VideoFit } from "./preferences"
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

type TimelineSegment = {
  key: string
  start: number
  end: number
  kind: "main" | "opening" | "ending"
}

type TimelineChapter = Omit<TimelineSegment, "key" | "kind"> & {
  kind: "opening" | "ending"
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

const videoFitClass: Record<VideoFit, string> = {
  contain: "object-contain",
  cover: "object-cover",
  fill: "object-fill",
}

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

const episodeLabel = (episode: StreamEpisode) => `Episode ${episode.number}`

const isGenericEpisodeTitle = (episode: StreamEpisode) =>
  episode.title.trim().toLowerCase() === episodeLabel(episode).toLowerCase()

const episodeTitle = (episode: StreamEpisode) =>
  isGenericEpisodeTitle(episode) ? null : episode.title

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

const subtitleTags = new Set(["b", "i", "u", "ruby", "rt", "rp", "span", "br"])

const escapeSubtitleText = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const serializeSubtitleNode = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return escapeSubtitleText(node.textContent ?? "")
  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    return Array.from(node.childNodes).map(serializeSubtitleNode).join("")
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ""

  const element = node as Element
  const tagName = element.tagName.toLowerCase()
  const children = Array.from(element.childNodes)
    .map(serializeSubtitleNode)
    .join("")

  if (!subtitleTags.has(tagName)) return children
  if (tagName === "br") return "<br />"
  return `<${tagName}>${children}</${tagName}>`
}

const subtitleCueHtml = (cue: TextTrackCue) => {
  if (cue instanceof VTTCue) {
    return serializeSubtitleNode(cue.getCueAsHTML())
  }

  return ""
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

const clampTime = (value: number, duration: number) =>
  Math.min(Math.max(value, 0), duration)

const chapterTimelineSegments = ({
  intro,
  outro,
  duration,
}: {
  intro: StreamPlayback["intro"]
  outro: StreamPlayback["outro"]
  duration: number
}): Array<TimelineSegment> => {
  if (duration <= 0) {
    return [{ key: "main-0", start: 0, end: 1, kind: "main" }]
  }

  const chapters = [
    intro
      ? {
          start: clampTime(intro.start, duration),
          end: clampTime(intro.end, duration),
          kind: "opening" as const,
        }
      : null,
    outro
      ? {
          start: clampTime(outro.start, duration),
          end: clampTime(outro.end, duration),
          kind: "ending" as const,
        }
      : null,
  ]
    .filter((chapter): chapter is TimelineChapter => Boolean(chapter))
    .filter((chapter) => chapter.end > chapter.start)
    .sort((a, b) => a.start - b.start)

  const segments: Array<TimelineSegment> = []
  let cursor = 0

  for (const chapter of chapters) {
    const start = Math.max(chapter.start, cursor)
    const end = Math.max(chapter.end, start)
    if (start > cursor) {
      segments.push({
        key: `main-${segments.length}`,
        start: cursor,
        end: start,
        kind: "main",
      })
    }
    if (end > start) {
      segments.push({
        key: chapter.kind,
        start,
        end,
        kind: chapter.kind,
      })
      cursor = end
    }
  }

  if (cursor < duration) {
    segments.push({
      key: `main-${segments.length}`,
      start: cursor,
      end: duration,
      kind: "main",
    })
  }

  return segments.length > 0
    ? segments
    : [{ key: "main-0", start: 0, end: duration, kind: "main" }]
}

const timelineFillPercent = (segment: TimelineSegment, time: number) => {
  if (time <= segment.start) return 0
  if (time >= segment.end) return 100
  return ((time - segment.start) / (segment.end - segment.start)) * 100
}

const segmentAtTime = (
  segments: ReadonlyArray<TimelineSegment>,
  time: number | null
) => {
  if (time === null) return null
  return (
    segments.find((segment) => time >= segment.start && time <= segment.end) ??
    null
  )
}

const timelineSegmentLabel = (segment: TimelineSegment | null) => {
  if (segment?.kind === "opening") return "Opening"
  if (segment?.kind === "ending") return "Ending"
  return null
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
  const [volume, setVolume] = useState(1)
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
  const [streamRetryKey, setStreamRetryKey] = useState(0)
  const [streamRetryAttempt, setStreamRetryAttempt] = useState(0)
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

  const reportPlayerError = (message: string) => {
    setPlayerError(message)
    toast.error(message)
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
    setVolume(video.volume)
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
    setStreamRetryAttempt(0)
    setStreamRetryKey(0)
    setPlayerError(null)
  }, [sourceUrl])

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
              reportPlayerError(
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

        reportPlayerError("This browser cannot play the selected stream format.")
      })
      .catch(() => {
        if (!disposed) {
          reportPlayerError(
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
  }, [sourceUrl, streamRetryKey])

  useEffect(() => {
    if (!playerError || streamRetryAttempt >= 3) return
    const timeout = window.setTimeout(() => {
      const nextAttempt = streamRetryAttempt + 1
      toast.message(`Retrying stream (${nextAttempt}/3)...`)
      setStreamRetryAttempt(nextAttempt)
      setStreamRetryKey((value) => value + 1)
    }, 10000)
    return () => window.clearTimeout(timeout)
  }, [playerError, streamRetryAttempt])

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
        .map(subtitleCueHtml)
        .filter((html) => html.length > 0)
      setActiveSubtitle(cues.length > 0 ? cues.join("<br />") : null)
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
    if (!preferences.autoSkipIntro || !skipSegmentVisible(playback.intro, currentTime)) {
      return
    }
    skipTo(skipTarget(playback.intro, duration))
  }, [currentTime, duration, playback.intro, preferences.autoSkipIntro])

  useEffect(() => {
    if (!preferences.autoSkipOutro || !skipSegmentVisible(playback.outro, currentTime)) {
      return
    }
    skipTo(skipTarget(playback.outro, duration))
  }, [currentTime, duration, playback.outro, preferences.autoSkipOutro])

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

  const intro = playback.intro
  const outro = playback.outro
  const timelineSegments = chapterTimelineSegments({ intro, outro, duration })
  const hoverSegment = segmentAtTime(timelineSegments, hoverTime)
  const hoverSegmentLabel = timelineSegmentLabel(hoverSegment)
  const hoverPreviewPercent = Math.min(
    Math.max(hoverPercent, thumbnailCue ? 8 : 4),
    thumbnailCue ? 92 : 96
  )
  const showIntroSkip = skipSegmentVisible(intro, currentTime)
  const showOutroSkip = skipSegmentVisible(outro, currentTime)
  const playerPortalContainer = fullscreen ? playerRef.current : null
  const centerIndicatorIcon = playing ? "pause" : "play"
  const displayEpisodeTitle = episodeTitle(playback.episode)

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
      <main className="relative flex flex-1 items-center justify-center bg-black">
        <video
          ref={videoRef}
          className={cn(
            "kaiser-stream-video size-full max-h-full max-w-full bg-black",
            videoFitClass[preferences.videoFit]
          )}
          playsInline
          crossOrigin="anonymous"
          onClick={togglePlayback}
          onCanPlay={() => {
            setPlayerError(null)
            setStreamRetryAttempt(0)
          }}
          onError={() => {
            reportPlayerError(
              "The stream failed to load. Retrying if possible."
            )
          }}
          onLoadedMetadata={() => {
            syncTimeline()
            applyCaptionTracks()
          }}
          onDurationChange={syncTimeline}
          onTimeUpdate={syncTimeline}
          onProgress={syncTimeline}
          onEnded={finishEpisode}
          onPlay={() => {
            setPlaying(true)
          }}
          onPause={() => {
            setPlaying(false)
          }}
          onVolumeChange={(event) => {
            setMuted(event.currentTarget.muted)
            setVolume(event.currentTarget.volume)
          }}
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

        <div
          className={cn(
            "pointer-events-none absolute top-1/2 left-1/2 z-10 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white shadow-2xl ring-1 ring-white/15 backdrop-blur-md transition-opacity duration-200 md:size-24 [&_svg]:size-9 md:[&_svg]:size-11",
            playing && !controlsVisible && "opacity-0"
          )}
        >
          {centerIndicatorIcon === "play" ? <Play /> : <Pause />}
        </div>

        {activeSubtitle ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-6 z-10 mx-auto max-w-5xl text-center text-xl font-semibold text-white transition-[bottom] duration-200 md:text-2xl",
              controlsVisible ? "bottom-36 md:bottom-40" : "bottom-10"
            )}
          >
            <span
              className="rounded-lg bg-black/75 box-decoration-clone px-2.5 py-1 leading-relaxed shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
              dangerouslySetInnerHTML={{ __html: activeSubtitle }}
            />
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-4 bottom-20 flex flex-wrap justify-center gap-2 md:bottom-24">
          {showIntroSkip && intro ? (
            <Button
              className="pointer-events-auto border border-white/35 bg-black/70 text-white shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur-md hover:border-white hover:bg-white hover:text-black"
              variant="secondary"
              size="sm"
              onClick={() => skipTo(skipTarget(intro, duration))}
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
              onClick={() => skipTo(skipTarget(outro, duration))}
            >
              <SkipForward data-icon="inline-start" />
              Skip outro
            </Button>
          ) : null}
        </div>

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black via-black/75 to-transparent p-3 transition-opacity duration-200 sm:gap-3 sm:p-4",
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
              onClick={togglePlayback}
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

          <div className="flex items-center gap-3 text-xs text-white/70">
            <span className="w-12 tabular-nums">{formatTime(currentTime)}</span>
            <div
              className="relative h-5 flex-1"
              onPointerMove={updateHoverPreview}
              onPointerLeave={() => setHoverTime(null)}
            >
              {hoverTime !== null ? (
                <div
                  className="pointer-events-none absolute bottom-8 z-20 flex -translate-x-1/2 flex-col items-center gap-1"
                  style={{ left: `${hoverPreviewPercent}%` }}
                >
                  {thumbnailCue ? (
                    <div className="rounded-xl border border-white/10 bg-black/90 p-1 shadow-2xl">
                      <ThumbnailPreview image={thumbnailCue.image} />
                    </div>
                  ) : null}
                  {hoverSegmentLabel ? (
                    <div className="rounded-md border border-white/10 bg-black/75 px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-white/75 uppercase shadow-xl backdrop-blur">
                      {hoverSegmentLabel}
                    </div>
                  ) : null}
                  <p className="rounded-lg border border-white/10 bg-black/85 px-3 py-1.5 text-base font-semibold text-white shadow-2xl tabular-nums backdrop-blur">
                    {formatTime(hoverTime)}
                  </p>
                </div>
              ) : null}
              <div className="absolute top-1/2 flex h-1 w-full -translate-y-1/2 gap-1">
                {timelineSegments.map((segment) => (
                  <div
                    key={segment.key}
                    className="relative h-1 min-w-1 overflow-hidden rounded-full bg-white/15"
                    style={{
                      flexGrow: Math.max(segment.end - segment.start, 0.1),
                      flexBasis: 0,
                    }}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-white/25"
                      style={{
                        width: `${timelineFillPercent(segment, bufferedEnd)}%`,
                      }}
                    />
                    {hoverTime !== null ? (
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 bg-white/35"
                        style={{
                          width: `${timelineFillPercent(segment, hoverTime)}%`,
                        }}
                      />
                    ) : null}
                    <div
                      className="absolute inset-y-0 left-0 bg-white"
                      style={{
                        width: `${timelineFillPercent(segment, currentTime)}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
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
              <div className="group/volume flex items-center gap-1 rounded-full focus-within:bg-white/10 hover:bg-white/10">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white hover:bg-transparent hover:text-white"
                  onClick={toggleMute}
                >
                  {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
                  <span className="sr-only">{muted ? "Unmute" : "Mute"}</span>
                </Button>
                <div className="grid w-0 overflow-hidden transition-[width,opacity] duration-150 group-focus-within/volume:w-24 group-focus-within/volume:opacity-100 group-hover/volume:w-24 group-hover/volume:opacity-100 opacity-0">
                  <input
                    aria-label="Volume"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={muted ? 0 : volume}
                    onChange={(event) => {
                      const video = videoRef.current
                      if (!video) return
                      const nextVolume = Number(event.currentTarget.value)
                      video.volume = nextVolume
                      video.muted = nextVolume === 0
                      setVolume(nextVolume)
                      setMuted(video.muted)
                    }}
                    className="h-8 w-24 cursor-pointer accent-white"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PlayerSettingsPopover
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                portalContainer={playerPortalContainer}
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
    </div>
  )
}

function PlayerSettingsPopover({
  open,
  onOpenChange,
  portalContainer,
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
  portalContainer: HTMLElement | null
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
  const [view, setView] = useState<
    "main" | "quality" | "captions" | "speed" | "audio"
  >("main")
  const currentQuality =
    quality === "-1"
      ? "Auto"
      : qualityLevels.find((level) => String(level.index) === quality)?.label ??
        "Auto"
  const currentCaption =
    caption === "off" ? "Off" : playback.tracks[Number(caption)]?.label ?? "Off"
  const currentSpeed = speed === "1" ? "Normal" : `${speed}x`

  const choose = (action: () => void) => {
    action()
    setView("main")
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <Settings />
          <span className="sr-only">Player settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        portalContainer={portalContainer}
        align="end"
        side="top"
        sideOffset={12}
        className="max-h-[min(34rem,calc(100dvh-7rem))] w-[min(28rem,calc(100vw-1.5rem))] gap-0 overflow-hidden rounded-2xl border border-white/10 bg-black/90 p-0 text-white shadow-2xl ring-white/10 backdrop-blur-md"
      >
        <div className="max-h-[inherit] overflow-y-auto">
          {view === "main" ? (
            <div className="flex flex-col py-2">
              <PlayerPreferenceSwitch
                icon={<Play />}
                label="Autoplay"
                checked={preferences.autoplay}
                onCheckedChange={(checked) =>
                  onPreferencesChange({ autoplay: checked })
                }
              />
              <PlayerPreferenceSwitch
                icon={<SkipForward />}
                label="Auto next"
                checked={preferences.autoNext}
                onCheckedChange={(checked) =>
                  onPreferencesChange({ autoNext: checked })
                }
              />
              <PlayerPreferenceSwitch
                icon={<SkipForward />}
                label="Auto skip intro"
                checked={preferences.autoSkipIntro}
                onCheckedChange={(checked) =>
                  onPreferencesChange({ autoSkipIntro: checked })
                }
              />
              <PlayerPreferenceSwitch
                icon={<SkipForward />}
                label="Auto skip outro"
                checked={preferences.autoSkipOutro}
                onCheckedChange={(checked) =>
                  onPreferencesChange({ autoSkipOutro: checked })
                }
              />
              <div className="my-2 h-px bg-white/10" />
              <SettingSegmented
                label="Video fit"
                value={preferences.videoFit}
                options={[
                  ["contain", "Contain"],
                  ["cover", "Cover"],
                  ["fill", "Fill"],
                ]}
                onValueChange={(videoFit) => onPreferencesChange({ videoFit })}
              />
              <div className="my-2 h-px bg-white/10" />
              <SettingNavRow
                icon={<Gauge />}
                label="Quality"
                value={currentQuality}
                onClick={() => setView("quality")}
              />
              <SettingNavRow
                icon={<Play />}
                label="Speed"
                value={currentSpeed}
                onClick={() => setView("speed")}
              />
              <SettingNavRow
                icon={<Volume2 />}
                label="Audio"
                value={audioLabel(playback.audio)}
                onClick={() => setView("audio")}
              />
              <SettingNavRow
                icon={<Captions />}
                label="Subtitles"
                value={currentCaption}
                onClick={() => setView("captions")}
              />
            </div>
          ) : null}

          {view === "quality" ? (
            <SettingsOptionPage title="Quality" onBack={() => setView("main")}>
              <SettingsOption
                label="Auto"
                selected={quality === "-1"}
                onClick={() => choose(() => onQualityChange("-1"))}
              />
              {qualityLevels.map((level) => (
                <SettingsOption
                  key={level.index}
                  label={level.label}
                  selected={quality === String(level.index)}
                  onClick={() =>
                    choose(() => onQualityChange(String(level.index)))
                  }
                />
              ))}
            </SettingsOptionPage>
          ) : null}

          {view === "captions" ? (
            <SettingsOptionPage
              title="Subtitles"
              onBack={() => setView("main")}
            >
              <SettingsOption
                label="Off"
                selected={caption === "off"}
                onClick={() => choose(() => onCaptionChange("off"))}
              />
              {playback.tracks.map((track, index) => (
                <SettingsOption
                  key={`${track.file}-${index}`}
                  label={track.label}
                  selected={caption === String(index)}
                  onClick={() => choose(() => onCaptionChange(String(index)))}
                />
              ))}
            </SettingsOptionPage>
          ) : null}

          {view === "speed" ? (
            <SettingsOptionPage title="Speed" onBack={() => setView("main")}>
              {speedOptions.map((option) => (
                <SettingsOption
                  key={option}
                  label={option === "1" ? "Normal" : `${option}x`}
                  selected={speed === option}
                  onClick={() => choose(() => onSpeedChange(option))}
                />
              ))}
            </SettingsOptionPage>
          ) : null}

          {view === "audio" ? (
            <SettingsOptionPage title="Audio" onBack={() => setView("main")}>
              {playback.episode.availableAudio.map((audio) => (
                <SettingsOption
                  key={audio}
                  asChild
                  label={audioLabel(audio)}
                  selected={audio === playback.audio}
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
                </SettingsOption>
              ))}
            </SettingsOptionPage>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function PlayerPreferenceSwitch({
  icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: ReactNode
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 px-5 py-2">
      <div className="flex min-w-0 items-center gap-4">
        <span className="text-white/60">{icon}</span>
        <p className="truncate text-base font-medium">{label}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function SettingSegmented<TValue extends string>({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string
  value: TValue
  options: ReadonlyArray<readonly [TValue, string]>
  onValueChange: (value: TValue) => void
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 px-5 py-2">
      <p className="text-base font-medium">{label}</p>
      <div className="flex rounded-xl bg-white/10 p-1">
        {options.map(([option, optionLabel]) => (
          <button
            key={option}
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm text-white/60 transition",
              value === option && "bg-white/20 text-white"
            )}
            onClick={() => onValueChange(option)}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  )
}

function SettingNavRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: ReactNode
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="flex min-h-14 items-center justify-between gap-4 px-5 py-2 text-left transition hover:bg-white/10"
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-4">
        <span className="text-white/60">{icon}</span>
        <span className="truncate text-base font-medium">{label}</span>
      </span>
      <span className="flex min-w-0 items-center gap-2 text-white/50">
        <span className="truncate">{value}</span>
        <ChevronRight />
      </span>
    </button>
  )
}

function SettingsOptionPage({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div className="flex flex-col">
      <div className="flex min-h-14 items-center gap-2 border-b border-white/10 px-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={onBack}
        >
          <ChevronLeft />
          <span className="sr-only">Back</span>
        </Button>
        <p className="text-base font-semibold">{title}</p>
      </div>
      <div className="flex flex-col py-2">{children}</div>
    </div>
  )
}

function SettingsOption({
  label,
  selected,
  onClick,
  asChild = false,
  children,
}: {
  label: string
  selected: boolean
  onClick?: () => void
  asChild?: boolean
  children?: ReactNode
}) {
  if (asChild) {
    return (
      <div className="grid grid-cols-[2rem_1fr] items-center gap-4 px-5 py-3 text-base transition hover:bg-white/10">
        <span className="text-white">{selected ? <Check /> : null}</span>
        <span>{children}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="grid grid-cols-[2rem_1fr] items-center gap-4 px-5 py-3 text-left text-base transition hover:bg-white/10"
      onClick={onClick}
    >
      <span className="text-white">{selected ? <Check /> : null}</span>
      <span>{label}</span>
    </button>
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
  portalContainer,
  playback,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  portalContainer: HTMLElement | null
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
      <SheetContent
        className="w-[min(92vw,28rem)] bg-background"
        portalContainer={portalContainer}
        side="right"
      >
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
  const [query, setQuery] = useState("")
  const [descending, setDescending] = useState(false)
  const [page, setPage] = useState(1)

  const filteredEpisodes = provider.episodes
    .filter((episode) => {
      const normalizedQuery = query.trim().toLowerCase()
      if (normalizedQuery.length === 0) return true
      return [
        String(episode.number),
        episode.title,
        episode.japaneseTitle ?? "",
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    })
    .sort((left, right) =>
      descending ? right.number - left.number : left.number - right.number
    )
  const compact = provider.episodes.length >= 48
  const pageSize = compact ? 80 : 30
  const totalPages = Math.max(1, Math.ceil(filteredEpisodes.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleEpisodes = filteredEpisodes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  if (provider.status !== "available") {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        {provider.message ?? "This provider is unavailable."}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value)
              setPage(1)
            }}
            className="pl-9"
            placeholder="Search episodes"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDescending((value) => !value)
            setPage(1)
          }}
        >
          <ArrowDownUp data-icon="inline-start" />
          {descending ? "Newest first" : "Oldest first"}
        </Button>
      </div>

      {visibleEpisodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No episodes match your search.
        </div>
      ) : (
        <TooltipProvider>
          <div
            className={cn(
              "grid gap-2",
              compact
                ? "grid-cols-[repeat(auto-fill,minmax(3rem,1fr))]"
                : "grid-cols-1"
            )}
          >
            {visibleEpisodes.map((episode) =>
              compact ? (
                <EpisodeSheetNumberButton
                  key={episode.id}
                  episode={episode}
                  playback={playback}
                  onSelect={onSelect}
                />
              ) : (
                <EpisodeSheetRow
                  key={episode.id}
                  episode={episode}
                  playback={playback}
                  onSelect={onSelect}
                />
              )
            )}
          </div>
        </TooltipProvider>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft data-icon="inline-start" />
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() =>
              setPage((value) => Math.min(totalPages, value + 1))
            }
          >
            Next
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      ) : null}
    </>
  )
}

function episodeAudioForPlayback(
  episode: StreamEpisode,
  playback: StreamPlayback
) {
  return episode.availableAudio.includes(playback.audio)
    ? playback.audio
    : preferredAudio(episode)
}

function episodeWatchHref({
  episode,
  playback,
  audio,
}: {
  episode: StreamEpisode
  playback: StreamPlayback
  audio: StreamAudio
}) {
  return watchHref({
    malId: playback.anime.malId,
    provider: playback.provider,
    episodeId: episode.id,
    audio,
  })
}

function EpisodeSheetRow({
  episode,
  playback,
  onSelect,
}: {
  episode: StreamEpisode
  playback: StreamPlayback
  onSelect: () => void
}) {
  const audio = episodeAudioForPlayback(episode, playback)
  const isCurrent = episode.id === playback.episode.id
  const title = episodeTitle(episode)
  const content = (
    <>
      <div
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-2xl border bg-muted text-sm font-semibold tabular-nums",
          isCurrent && "border-primary bg-primary text-primary-foreground"
        )}
      >
        {episode.number}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">
            {title ?? episodeLabel(episode)}
          </span>
          {isCurrent ? <Badge>Now playing</Badge> : null}
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {title ? <span>{episodeLabel(episode)}</span> : null}
          {episode.availableAudio.map((item) => (
            <Badge key={item} variant="outline">
              {audioLabel(item)}
            </Badge>
          ))}
        </div>
      </div>
      <div
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full border bg-background transition-colors",
          audio && "group-hover/episode:bg-primary group-hover/episode:text-primary-foreground",
          !audio && "text-muted-foreground"
        )}
      >
        <Play />
      </div>
    </>
  )
  const className = cn(
    "group/episode flex min-h-16 items-center gap-3 rounded-xl border bg-card/70 p-2.5 text-left transition hover:border-primary/40 hover:bg-accent/60",
    isCurrent && "border-primary/60 bg-accent",
    !audio && "opacity-60"
  )

  if (!audio) {
    return (
      <div className={className} aria-disabled="true">
        {content}
      </div>
    )
  }

  return (
    <a
      href={episodeWatchHref({ episode, playback, audio })}
      className={className}
      onClick={onSelect}
    >
      {content}
    </a>
  )
}

function EpisodeSheetNumberButton({
  episode,
  playback,
  onSelect,
}: {
  episode: StreamEpisode
  playback: StreamPlayback
  onSelect: () => void
}) {
  const audio = episodeAudioForPlayback(episode, playback)
  const isCurrent = episode.id === playback.episode.id
  const title = episodeTitle(episode)
  const label = title ?? episodeLabel(episode)
  const className = cn(
    "h-11 rounded-xl px-0 text-sm tabular-nums",
    isCurrent && "ring-2 ring-primary/40"
  )
  const trigger = audio ? (
    <Button
      asChild
      variant={isCurrent ? "default" : "outline"}
      className={className}
    >
      <a
        href={episodeWatchHref({ episode, playback, audio })}
        onClick={onSelect}
      >
        {episode.number}
      </a>
    </Button>
  ) : (
    <span>
      <Button variant="outline" className={className} disabled>
        {episode.number}
      </Button>
    </span>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{label}</span>
          <span className="text-background/70">{episodeLabel(episode)}</span>
          <span className="text-background/70">
            {audio ? episode.availableAudio.map(audioLabel).join(" / ") : "No streams"}
          </span>
          {isCurrent ? (
            <span className="text-background/70">Now playing</span>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  )
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
