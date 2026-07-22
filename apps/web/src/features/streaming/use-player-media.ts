import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import type Hls from "hls.js"
import type { SyntheticEvent } from "react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { qualityLabel } from "./player-format"
import {
  playerQualityAtom,
  playerQualityLevelsAtom,
  playerSpeedAtom,
} from "./player-ui-state"

export function usePlayerMedia({
  sourceUrl,
  audioEnhancementPercent,
  failureKey,
  onFatalError,
}: {
  sourceUrl: string
  audioEnhancementPercent: number
  failureKey: string
  onFatalError: () => boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const audioGainRef = useRef<GainNode | null>(null)
  const reportedFailureRef = useRef<string | null>(null)
  const onFatalErrorRef = useRef(onFatalError)
  onFatalErrorRef.current = onFatalError
  const quality = useAtomValue(playerQualityAtom)
  const setQuality = useAtomSet(playerQualityAtom)
  const speed = useAtomValue(playerSpeedAtom)
  const setQualityLevels = useAtomSet(playerQualityLevelsAtom)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(true)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [streamRetryKey, setStreamRetryKey] = useState(0)
  const [streamRetryAttempt, setStreamRetryAttempt] = useState(0)

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

  const reportPlayerError = (message: string) => {
    setBuffering(false)
    if (reportedFailureRef.current === failureKey) return
    reportedFailureRef.current = failureKey
    if (onFatalErrorRef.current()) return
    setPlayerError(message)
    toast.error(message)
  }

  const ensureAudioGain = () => {
    const video = videoRef.current
    if (!video) return null
    const context = audioContextRef.current ?? new AudioContext()
    audioContextRef.current = context
    if (!audioSourceRef.current || !audioGainRef.current) {
      const source = context.createMediaElementSource(video)
      const gain = context.createGain()
      source.connect(gain).connect(context.destination)
      audioSourceRef.current = source
      audioGainRef.current = gain
    }
    return { gain: audioGainRef.current }
  }

  const seekTo = (value: string) => {
    const video = videoRef.current
    if (!video) return
    const nextTime = Number(value)
    video.currentTime = nextTime
    setCurrentTime(nextTime)
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

  const skipTo = (seconds: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = seconds
    void video.play().catch(() => undefined)
  }

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void audioContextRef.current?.resume()
      void video.play().catch(() => undefined)
      return
    }
    video.pause()
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  const adjustVolume = (delta: number) => {
    const video = videoRef.current
    if (!video) return
    video.volume = Math.min(Math.max(video.volume + delta, 0), 1)
    video.muted = video.volume === 0
    setVolume(video.volume)
    setMuted(video.muted)
  }

  const setVideoVolume = (nextVolume: number) => {
    const video = videoRef.current
    if (!video) return
    video.volume = nextVolume
    video.muted = nextVolume === 0
    setVolume(nextVolume)
    setMuted(video.muted)
  }

  useEffect(() => {
    setStreamRetryAttempt(0)
    setStreamRetryKey(0)
    setPlayerError(null)
    setBuffering(true)
  }, [sourceUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let disposed = false
    let attachedHls: Hls | null = null

    setPlayerError(null)
    setBuffering(true)
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

        reportPlayerError(
          "This browser cannot play the selected stream format."
        )
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
  }, [failureKey, sourceUrl, streamRetryKey])

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
    if (audioEnhancementPercent === 100 && !audioGainRef.current) return
    const graph = ensureAudioGain()
    if (!graph) return
    graph.gain.gain.value = audioEnhancementPercent / 100
  }, [audioEnhancementPercent])

  useEffect(
    () => () => {
      void audioContextRef.current?.close()
    },
    []
  )

  return {
    videoRef,
    playing,
    buffering,
    muted,
    volume,
    currentTime,
    duration,
    bufferedEnd,
    seekTo,
    seekBy,
    skipTo,
    togglePlayback,
    toggleMute,
    adjustVolume,
    setVideoVolume,
    videoHandlers: {
      onLoadStart: () => setBuffering(true),
      onWaiting: () => setBuffering(true),
      onStalled: () => setBuffering(true),
      onLoadedData: () => setBuffering(false),
      onCanPlay: () => {
        setBuffering(false)
        setPlayerError(null)
        setStreamRetryAttempt(0)
        reportedFailureRef.current = null
      },
      onCanPlayThrough: () => setBuffering(false),
      onError: () => {
        setBuffering(false)
        reportPlayerError("The stream failed to load. Retrying if possible.")
      },
      onLoadedMetadata: syncTimeline,
      onDurationChange: syncTimeline,
      onTimeUpdate: syncTimeline,
      onProgress: syncTimeline,
      onPlay: () => setPlaying(true),
      onPlaying: () => setBuffering(false),
      onPause: () => {
        setPlaying(false)
        setBuffering(false)
      },
      onVolumeChange: (event: SyntheticEvent<HTMLVideoElement>) => {
        setMuted(event.currentTarget.muted)
        setVolume(event.currentTarget.volume)
      },
    },
  }
}
