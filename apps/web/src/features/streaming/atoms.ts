import type { StreamAudio, StreamProviderId } from "@animekaiser/domain"
import { KaiserRpcClient } from "../../services/api-clients"

export const streamEpisodesAtom = (malId: number, provider: StreamProviderId) =>
  KaiserRpcClient.query(
    "ListStreamEpisodes",
    { malId, provider },
    { timeToLive: "1 minute" }
  )

export const streamPlaybackAtom = (
  malId: number,
  provider: StreamProviderId,
  episodeId: string,
  audio: StreamAudio,
  serverId?: string | undefined
) =>
  KaiserRpcClient.query("GetStreamPlayback", {
    malId,
    provider,
    episodeId,
    audio,
    serverId,
  })
