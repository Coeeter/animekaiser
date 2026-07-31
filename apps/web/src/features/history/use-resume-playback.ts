import type { StreamPlayback } from "@animekaiser/domain"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import type { RefObject } from "react"
import { useEffect, useRef } from "react"
import { episodeWatchProgressAtom } from "./atoms"

const minimumResumeSeconds = 10
const endOfEpisodeGuardSeconds = 30

export function useResumePlayback({
  playback,
  videoRef,
}: {
  playback: StreamPlayback
  videoRef: RefObject<HTMLVideoElement | null>
}) {
  const episode = Math.max(1, Math.floor(playback.episode.number))
  const result = useAtomValue(
    episodeWatchProgressAtom(playback.anime.malId, episode)
  )

  const entry = Result.builder(result)
    .onSuccess((value) => value)
    .orNull()

  const resumedKeyRef = useRef<string | null>(null)
  const episodeKey = `${playback.provider}:${playback.episode.id}`

  useEffect(() => {
    resumedKeyRef.current = null
  }, [episodeKey])

  useEffect(() => {
    if (!entry || entry.status === "completed") return
    if (entry.positionSeconds < minimumResumeSeconds) return
    if (resumedKeyRef.current === episodeKey) return

    const video = videoRef.current
    if (!video) return

    const target = entry.positionSeconds

    const apply = () => {
      if (resumedKeyRef.current === episodeKey) return

      const duration = video.duration
      if (!Number.isFinite(duration) || duration <= 0) return

      if (target > duration - endOfEpisodeGuardSeconds) {
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
  }, [entry, episodeKey, videoRef])
}
