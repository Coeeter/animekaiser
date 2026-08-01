import type { WatchHistoryEntry } from "@animekaiser/domain"

export const minimumResumeSeconds = 10

export type EpisodeProgress = {
  watched: boolean
  continueWatching: boolean
  progressPercent: number
  upNext: boolean
}

const percentOf = (entry: WatchHistoryEntry) => {
  if (!entry.durationSeconds || entry.durationSeconds <= 0) return 0
  const percent = (entry.positionSeconds / entry.durationSeconds) * 100
  return Math.min(100, Math.max(0, Math.round(percent)))
}

export const episodeProgressByNumber = ({
  episodeNumbers,
  entries,
  libraryProgress,
}: {
  episodeNumbers: ReadonlyArray<number>
  entries: ReadonlyArray<WatchHistoryEntry>
  libraryProgress: number | null
}): Map<number, EpisodeProgress> => {
  const entryByEpisode = new Map(entries.map((entry) => [entry.episode, entry]))
  const ordered = Array.from(new Set(episodeNumbers)).sort(
    (left, right) => left - right
  )

  const states = ordered.map((number) => {
    const entry = entryByEpisode.get(number) ?? null
    const watched =
      entry?.status === "completed" ||
      (libraryProgress !== null && number <= libraryProgress)

    return {
      number,
      watched,
      continueWatching:
        !watched &&
        entry !== null &&
        entry.positionSeconds >= minimumResumeSeconds,
      progressPercent: watched ? 100 : entry ? percentOf(entry) : 0,
    }
  })

  const upNext = states.find((state) => !state.watched)?.number ?? null

  return new Map(
    states.map((state) => [
      state.number,
      {
        watched: state.watched,
        continueWatching: state.continueWatching,
        progressPercent: state.progressPercent,
        upNext: state.number === upNext,
      },
    ])
  )
}
