import type {
  RoomPlayback,
  RoomPlaybackAction,
  RoomPlaybackState,
  StreamAudio,
  StreamEpisode,
  StreamPlayback,
  StreamProviderId,
} from "@animekaiser/domain"
import type { ReactNode, RefObject } from "react"
import { createContext, useContext, useEffect, useRef } from "react"

export type RoomPlayerController = {
  readonly roomId: string
  readonly selectionRevision: number
  readonly playback: RoomPlayback
  readonly clockOffset: number
  readonly canControl: boolean
  readonly isHost: boolean
  readonly isAccount: boolean
  readonly controller: boolean
  readonly connected: boolean
  readonly hostAway: boolean
  readonly hostReconnecting: boolean
  readonly panel: ReactNode
  readonly command: (action: RoomPlaybackAction) => void
  readonly selectEpisode: (
    episode: StreamEpisode,
    audio: StreamAudio,
    options?: { play?: boolean; provider?: StreamProviderId }
  ) => void
  readonly setServerId: (serverId: string | undefined) => void
  readonly claimPlayback: () => void
  readonly reportState: (state: RoomPlaybackState) => void
  readonly recordViewing: (input: RoomViewingSample) => Promise<boolean>
}

export type RoomViewingSample = {
  playback: StreamPlayback
  positionSeconds: number
  durationSeconds: number | null
  segment: {
    fromSeconds: number
    toSeconds: number
    elapsedMs: number
    rate: number
  } | null
}

export const RoomPlayerContext = createContext<RoomPlayerController | null>(
  null
)

export const useRoomPlayer = () => useContext(RoomPlayerContext)

export const expectedRoomPosition = (
  playback: RoomPlayback,
  clockOffset: number
) =>
  playback.playing
    ? Math.max(
        0,
        playback.positionSeconds +
          ((Date.now() + clockOffset - playback.positionAt) / 1000) *
            playback.rate
      )
    : playback.positionSeconds

// Small drift is absorbed by briefly speeding up or slowing down, which is
// invisible; only larger gaps seek, which interrupts the picture.
const seekDriftSeconds = 1.5
const rateDriftSeconds = 0.2

export const correctedRate = (rate: number, driftSeconds: number) => {
  if (Math.abs(driftSeconds) <= rateDriftSeconds) return rate
  const factor = Math.min(1.1, Math.max(0.9, 1 - driftSeconds * 0.25))
  return rate * factor
}

export function useRoomSync({
  room,
  videoRef,
  onBlocked,
}: {
  room: RoomPlayerController | null
  videoRef: RefObject<HTMLVideoElement | null>
  onBlocked: (blocked: boolean) => void
}) {
  const roomRef = useRef(room)
  roomRef.current = room
  const blockedRef = useRef(false)
  const heldRef = useRef(false)
  const onBlockedRef = useRef(onBlocked)
  onBlockedRef.current = onBlocked
  const active = room !== null

  useEffect(() => {
    if (!active) return
    const setBlocked = (value: boolean) => {
      if (blockedRef.current === value) return
      blockedRef.current = value
      onBlockedRef.current(value)
    }

    const tick = () => {
      const current = roomRef.current
      const video = videoRef.current
      if (!current || !video) return
      if (!current.controller || !current.connected) {
        if (!video.paused) video.pause()
        return
      }
      if (heldRef.current) {
        if (!video.paused) video.pause()
        return
      }
      if (video.readyState < 1 || video.seeking) return
      const duration = Number.isFinite(video.duration) ? video.duration : null
      const expected = Math.min(
        expectedRoomPosition(current.playback, current.clockOffset),
        duration ?? Number.POSITIVE_INFINITY
      )
      const drift = video.currentTime - expected
      if (!current.playback.playing) {
        if (!video.paused) video.pause()
        video.playbackRate = current.playback.rate
        if (Math.abs(drift) > 0.25) video.currentTime = expected
        setBlocked(false)
        return
      }
      if (duration !== null && expected >= duration - 0.25) {
        if (!video.paused && video.currentTime >= duration - 0.25) return
      }
      if (Math.abs(drift) > seekDriftSeconds) {
        video.currentTime = expected
        return
      }
      if (video.readyState >= 3)
        video.playbackRate = correctedRate(current.playback.rate, drift)
      if (video.paused && !video.ended && !blockedRef.current) {
        void video
          .play()
          .then(() => setBlocked(false))
          .catch((error: unknown) => {
            if (
              error instanceof DOMException &&
              error.name === "NotAllowedError"
            )
              setBlocked(true)
          })
      }
    }

    const interval = window.setInterval(tick, 250)
    const onVisible = () => {
      if (document.visibilityState === "visible") tick()
    }
    document.addEventListener("visibilitychange", onVisible)
    tick()
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [active, videoRef])

  const joinPlayback = () => {
    const video = videoRef.current
    if (!video) return
    heldRef.current = false
    blockedRef.current = false
    onBlockedRef.current(false)
    const current = roomRef.current
    if (current)
      video.currentTime = expectedRoomPosition(
        current.playback,
        current.clockOffset
      )
    void video.play().catch(() => {
      blockedRef.current = true
      onBlockedRef.current(true)
    })
  }

  // A viewer without control can pause for themselves like a live stream; the
  // room keeps playing and joining again jumps back to the room's position.
  const holdPlayback = () => {
    heldRef.current = true
    videoRef.current?.pause()
  }

  return { joinPlayback, holdPlayback }
}

const viewingIntervalMs = 5_000

// Room viewing counts only time this browser actually played: a segment
// restarts after any seek, stall, or pause, so jumps never count as watched.
export function useRoomViewing({
  room,
  playback,
  videoRef,
  onCompleted,
}: {
  room: RoomPlayerController | null
  playback: StreamPlayback
  videoRef: RefObject<HTMLVideoElement | null>
  onCompleted: () => void
}) {
  const roomRef = useRef(room)
  roomRef.current = room
  const onCompletedRef = useRef(onCompleted)
  onCompletedRef.current = onCompleted
  const enabled = room?.isAccount
  const episodeKey = `${playback.provider}:${playback.episode.id}`

  useEffect(() => {
    if (!enabled) return
    const video = videoRef.current
    if (!video) return
    let start: { time: number; at: number } | null = null
    let lastSent = 0

    const resetSegment = () => {
      start =
        !video.paused && video.readyState >= 3
          ? { time: video.currentTime, at: performance.now() }
          : null
    }

    const send = () => {
      const current = roomRef.current
      if (!current) return
      const now = performance.now()
      const position = video.currentTime
      const segment =
        start && !video.seeking && position > start.time
          ? {
              fromSeconds: start.time,
              toSeconds: position,
              elapsedMs: Math.min(120_000, Math.round(now - start.at)),
              rate: video.playbackRate,
            }
          : null
      start = !video.paused ? { time: position, at: now } : null
      if (!segment && Math.abs(position - lastSent) < 1) return
      lastSent = position
      void current
        .recordViewing({
          playback,
          positionSeconds: position,
          durationSeconds:
            Number.isFinite(video.duration) && video.duration > 0
              ? video.duration
              : null,
          segment,
        })
        .then((newlyCompleted) => {
          if (newlyCompleted) onCompletedRef.current()
        })
    }

    const onPause = () => send()
    const interval = window.setInterval(() => {
      if (!video.paused && document.visibilityState === "visible") send()
    }, viewingIntervalMs)
    const onHidden = () => {
      if (document.visibilityState === "hidden") send()
    }

    video.addEventListener("playing", resetSegment)
    video.addEventListener("seeking", resetSegment)
    video.addEventListener("waiting", resetSegment)
    video.addEventListener("pause", onPause)
    video.addEventListener("ended", onPause)
    document.addEventListener("visibilitychange", onHidden)
    resetSegment()
    return () => {
      send()
      window.clearInterval(interval)
      video.removeEventListener("playing", resetSegment)
      video.removeEventListener("seeking", resetSegment)
      video.removeEventListener("waiting", resetSegment)
      video.removeEventListener("pause", onPause)
      video.removeEventListener("ended", onPause)
      document.removeEventListener("visibilitychange", onHidden)
    }
  }, [enabled, episodeKey, playback, videoRef])
}
