import type { StreamPlayback } from "@animekaiser/domain"
import { useAtomSet } from "@effect-atom/atom-react"
import { useCallback, useEffect, useRef } from "react"
import { recordWatchProgressAtom, watchHistoryReactivityKeys } from "./atoms"

// Meaningful moments are flushed immediately, so this only bounds how stale
// a position can get while playback runs uninterrupted.
const reportIntervalSeconds = 5

const minimumReportSeconds = 5

const positiveEpisode = (playback: StreamPlayback) => {
  const episode = Math.floor(playback.episode.number)
  return episode >= 1 ? episode : null
}

const wholeSeconds = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0

export function useWatchProgress({
  playback,
  currentTime,
  duration,
  playing,
}: {
  playback: StreamPlayback
  currentTime: number
  duration: number
  playing: boolean
}) {
  const record = useAtomSet(recordWatchProgressAtom, { mode: "promise" })

  const latestRef = useRef({ currentTime, duration })
  const lastSentSecondRef = useRef<number | null>(null)
  const episodeKey = `${playback.provider}:${playback.episode.id}`

  useEffect(() => {
    latestRef.current = { currentTime, duration }
  }, [currentTime, duration])

  const send = useCallback(
    (positionSeconds: number, durationSeconds: number) => {
      const episode = positiveEpisode(playback)
      if (episode === null || positionSeconds < minimumReportSeconds) return

      lastSentSecondRef.current = positionSeconds

      void record({
        payload: {
          anime: {
            malId: playback.anime.malId,
            aniListId: playback.anime.aniListId,
            title: playback.anime.title,
            coverImage: playback.anime.coverImage,
            episodes: playback.anime.episodes,
          },
          provider: playback.provider,
          episodeId: playback.episode.id,
          serverId: playback.server.id,
          serverName: playback.server.name,
          episode,
          audio: playback.audio,
          positionSeconds,
          durationSeconds: durationSeconds > 0 ? durationSeconds : null,
        },
        reactivityKeys: [watchHistoryReactivityKeys.all],
      }).catch(() => undefined)
    },
    [playback, record]
  )

  const flush = useCallback(() => {
    const { currentTime: time, duration: total } = latestRef.current
    send(wholeSeconds(time), wholeSeconds(total))
  }, [send])

  useEffect(() => {
    lastSentSecondRef.current = null
  }, [episodeKey])

  useEffect(() => {
    if (!playing) {
      flush()
      return
    }

    const interval = window.setInterval(flush, reportIntervalSeconds * 1000)
    return () => window.clearInterval(interval)
  }, [flush, playing])

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush()
    }

    document.addEventListener("visibilitychange", onHidden)
    window.addEventListener("pagehide", flush)

    return () => {
      document.removeEventListener("visibilitychange", onHidden)
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [flush])

  return { flushWatchProgress: flush }
}
