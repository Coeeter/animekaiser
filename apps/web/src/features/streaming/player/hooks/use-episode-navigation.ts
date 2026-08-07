import type { StreamEpisode, StreamPlayback } from "@animekaiser/domain"
import { useNavigate } from "@tanstack/react-router"
import { preferredAudio } from "../../player-format"

export function useEpisodeNavigation({
  playback,
  serverId,
  mode,
  isMobile,
  fullscreen,
  toggleFullscreen,
}: {
  playback: StreamPlayback
  serverId: string | undefined
  mode: "full" | "mini"
  isMobile: boolean
  fullscreen: boolean
  toggleFullscreen: () => void
}) {
  const navigate = useNavigate()

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

  const toggleMiniPlayer = () => {
    if (isMobile) return

    if (mode === "mini") {
      void navigate({
        to: "/watch/$malId/$provider/$episodeId",
        params: {
          malId: playback.anime.malId,
          provider: playback.provider,
          episodeId: playback.episode.id,
        },
        search: { audio: playback.audio, serverId },
      })
      return
    }

    if (fullscreen) toggleFullscreen()
    void navigate({ to: "/series/$id", params: { id: playback.anime.malId } })
  }

  return { navigateToEpisode, toggleMiniPlayer } as const
}
