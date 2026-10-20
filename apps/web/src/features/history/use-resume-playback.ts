import type { StreamPlayback } from "@animekaiser/domain"
import { useAtomValue } from "@effect/atom-react"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import type { RefObject } from "react"
import { useEffect, useRef } from "react"
import { episodeWatchProgressAtom } from "./atoms"
import { minimumResumeSeconds } from "./episode-progress"

const endOfEpisodeGuardSeconds = 30

export function useResumePlayback({
  playback,
  videoRef,
  enabled = true,
  sourcePosition,
}: {
  playback: StreamPlayback
  videoRef: RefObject<HTMLVideoElement | null>
  enabled?: boolean
  sourcePosition?: number
}) {
  const episode = Math.max(1, Math.floor(playback.episode.number))
  const result = useAtomValue(
    episodeWatchProgressAtom(playback.anime.malId, episode)
  )

  const entry = AsyncResult.builder(result)
    .onSuccess((value) => value)
    .orNull()

  const resumedKeyRef = useRef<string | null>(null)
  const episodeKey = `${playback.provider}:${playback.episode.id}:${playback.audio}:${playback.server.id}`

  useEffect(() => {
    resumedKeyRef.current = null
  }, [episodeKey])

  useEffect(() => {
    if (!enabled) return
    if (
      sourcePosition === undefined &&
      (!entry ||
        entry.status === "completed" ||
        entry.positionSeconds < minimumResumeSeconds)
    )
      return
    if (resumedKeyRef.current === episodeKey) return

    const video = videoRef.current
    if (!video) return

    const target = sourcePosition ?? entry?.positionSeconds ?? 0

    const apply = () => {
      if (resumedKeyRef.current === episodeKey) return

      // This entry refreshes mid-playback, so seeking to it would rewind the viewer.
      if (video.currentTime >= minimumResumeSeconds) {
        resumedKeyRef.current = episodeKey
        return
      }

      const duration = video.duration
      if (!Number.isFinite(duration) || duration <= 0) return

      if (
        target >
        duration -
          (sourcePosition === undefined ? endOfEpisodeGuardSeconds : 0.25)
      ) {
        resumedKeyRef.current = episodeKey
        return
      }

      video.currentTime = target
      resumedKeyRef.current = episodeKey
    }

    // hls.js attaches asynchronously and can clobber an early seek, so
    // `canplay` is a second chance after `loadedmetadata`.
    video.addEventListener("loadedmetadata", apply)
    video.addEventListener("canplay", apply)
    if (video.readyState >= 1) apply()

    return () => {
      video.removeEventListener("loadedmetadata", apply)
      video.removeEventListener("canplay", apply)
    }
  }, [enabled, entry, episodeKey, videoRef, sourcePosition])
}
