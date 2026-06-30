import { StreamingService } from "@workspace/core"
import { StreamingRpcs } from "@workspace/domain"
import * as Layer from "effect/Layer"

export const StreamingHandlersLive = StreamingRpcs.toLayer(
  StreamingRpcs.of({
    ListStreamEpisodes: ({ malId }) => StreamingService.listEpisodes(malId),
    GetStreamPlayback: ({ malId, provider, episodeId, audio, serverId }) =>
      StreamingService.getPlayback(malId, provider, episodeId, audio, serverId),
  })
).pipe(Layer.provide(StreamingService.Default))
