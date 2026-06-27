import type { StreamAudio, StreamProviderId } from "@workspace/domain"
import { KaiserAtomRpc } from "../../lib/rpc-client"

export const streamEpisodesAtom = (malId: number) =>
  KaiserAtomRpc.query(
    "ListStreamEpisodes",
    { malId },
    { timeToLive: "1 minute" }
  )

export const streamPlaybackAtom = (
  malId: number,
  provider: StreamProviderId,
  episodeId: string,
  audio: StreamAudio
) =>
  KaiserAtomRpc.query("GetStreamPlayback", {
    malId,
    provider,
    episodeId,
    audio,
  })
