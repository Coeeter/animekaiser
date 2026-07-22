import type {
  StreamAudio,
  StreamEpisode,
  StreamProviderId,
  StreamServer,
} from "@workspace/domain"
import type { VideoFit } from "./preferences"

export type QualityLevel = {
  index: number
  label: string
}

export const speedOptions = ["0.5", "0.75", "1", "1.25", "1.5", "2"] as const

export const megaPlayServerId = "default-server"

export const seriesEpisodesHref = (malId: number) => `/series/${malId}`

export const watchEpisodeNumber = (progress: number | null) =>
  progress !== null && progress > 1 ? progress + 1 : 1

export const watchAction = (
  progress: number | null,
  episodeNumbers: ReadonlyArray<number>
) => {
  const episodes = Array.from(new Set(episodeNumbers)).sort(
    (left, right) => left - right
  )
  const first = episodes[0]
  if (first === undefined) return null

  const episodeNumber = episodes.find(
    (number) => number >= watchEpisodeNumber(progress)
  )
  if (episodeNumber === undefined)
    return { episodeNumber: first, label: "Rewatch Anime" as const }

  return {
    episodeNumber,
    label:
      progress !== null && progress > 1
        ? ("Continue Watching" as const)
        : ("Start Watching" as const),
  }
}

export const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00"
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

const providerLabels: Record<StreamProviderId, string> = {
  "provider-e": "ProviderE",
  provider-a: "ProviderA",
  provider-b: "ProviderB",
  provider-c: "ProviderC",
  provider-d: "ProviderD",
}

export const providerLabel = (provider: StreamProviderId) =>
  providerLabels[provider]

const audioLabels: Record<StreamAudio, string> = {
  sub: "Sub",
  dub: "Dub",
}

export const audioLabel = (audio: StreamAudio) => audioLabels[audio]

export const videoFitClass: Record<VideoFit, string> = {
  contain: "object-contain",
  cover: "object-cover",
  fill: "object-fill",
}

export const watchHref = ({
  malId,
  provider,
  episodeId,
  audio,
  serverId,
}: {
  malId: number
  provider: StreamProviderId
  episodeId: string
  audio: StreamAudio
  serverId?: string | undefined
}) => {
  const search = new URLSearchParams({ audio })
  if (serverId) search.set("serverId", serverId)
  return `/watch/${malId}/${provider}/${encodeURIComponent(episodeId)}?${search.toString()}`
}

export const preferredAudio = (episode: StreamEpisode): StreamAudio | null => {
  if (episode.availableAudio.includes("sub")) return "sub"
  if (episode.availableAudio.includes("dub")) return "dub"
  return null
}

export const nextStreamServer = (
  servers: ReadonlyArray<StreamServer>,
  currentServerId: string,
  audio: StreamAudio
) => {
  const candidates = servers.filter((server) => server.audio === audio)
  const currentIndex = candidates.findIndex(
    (server) => server.id === currentServerId
  )
  return candidates[currentIndex + 1] ?? null
}

export const episodeLabel = (episode: StreamEpisode) =>
  `Episode ${episode.number}`

const isGenericEpisodeTitle = (episode: StreamEpisode) =>
  episode.title.trim().toLowerCase() === episodeLabel(episode).toLowerCase()

export const episodeTitle = (episode: StreamEpisode) =>
  isGenericEpisodeTitle(episode) ? null : episode.title

export const qualityLabel = (
  level: { height: number; bitrate: number },
  index: number
) => {
  const resolution =
    level.height > 0 ? `${level.height}p` : `Level ${index + 1}`
  const bitrate =
    level.bitrate > 0 ? ` (${Math.round(level.bitrate / 1000)} kbps)` : ""
  return `${resolution}${bitrate}`
}
