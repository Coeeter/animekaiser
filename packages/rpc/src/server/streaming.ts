import { StreamingService } from "@animekaiser/core"
import { StreamingRpcs } from "@animekaiser/domain"
import * as Layer from "effect/Layer"

export const StreamingHandlersLive = StreamingRpcs.toLayer(
  StreamingRpcs.of({
    ListStreamProviders: () => StreamingService.listProviders,
    ListStreamEpisodes: ({ malId, provider }) =>
      StreamingService.listEpisodes(malId, provider),
    GetStreamPlayback: ({ malId, provider, episodeId, audio, serverId }) =>
      StreamingService.getPlayback(malId, provider, episodeId, audio, serverId),
  })
).pipe(Layer.provide(StreamingService.Default))
