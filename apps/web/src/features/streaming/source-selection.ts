import type { StreamAudio, StreamProviderEpisodes } from "@animekaiser/domain"

export const matchingSourceEpisode = (
  catalog: StreamProviderEpisodes | undefined,
  number: number,
  audio: StreamAudio
) =>
  catalog?.status === "available"
    ? (catalog.episodes.find(
        (episode) =>
          episode.number === number && episode.availableAudio.includes(audio)
      ) ?? null)
    : null
