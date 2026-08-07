import type { StreamEpisode, StreamPlayback } from "@animekaiser/domain"
import { useAtomSet } from "@effect-atom/atom-react"
import { toast } from "sonner"
import { libraryMutationKeys, upsertLibraryAtom } from "../../../library/atoms"

export function usePlayerSync({
  playback,
  episodeKey,
  syncedEpisodeKey,
  onSyncedEpisodeKey,
  libraryEntry,
  syncLibraryOnFinish,
  flushWatchProgress,
  navigateToEpisode,
  nextEpisode,
  autoNext,
}: {
  playback: StreamPlayback
  episodeKey: string
  syncedEpisodeKey: string | null
  onSyncedEpisodeKey: (key: string) => void
  libraryEntry: {
    progress: number | null
    score: number | null
    notes: string | null
  } | null
  syncLibraryOnFinish: boolean
  flushWatchProgress: () => void
  navigateToEpisode: (episode: StreamEpisode | null) => void
  nextEpisode: StreamEpisode | null
  autoNext: boolean
}) {
  const upsertLibrary = useAtomSet(upsertLibraryAtom, { mode: "promise" })

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
          syncExternal: syncLibraryOnFinish,
        },
        reactivityKeys: libraryMutationKeys(playback.anime.malId),
      })
      onSyncedEpisodeKey(episodeKey)
    } catch {
      toast.error("Log in to sync episode progress to your library.")
    }
  }

  const finishEpisode = () => {
    void syncLibraryProgress()
    flushWatchProgress()
    if (autoNext) navigateToEpisode(nextEpisode)
  }

  return { finishEpisode } as const
}
