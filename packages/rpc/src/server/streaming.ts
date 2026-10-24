import { StreamingService } from "@animekaiser/core"
import { StreamingRpcs } from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export const StreamingHandlersLive = StreamingRpcs.toLayer(
  Effect.gen(function* () {
    const streamingService = yield* StreamingService
    return StreamingRpcs.of({
      ListStreamProviders: () => streamingService.listProviders,
      ListStreamEpisodes: ({ malId, provider }) =>
        streamingService.listEpisodes(malId, provider),
      ListStreamAvailability: ({ malId, provider }) =>
        streamingService.listAvailability(malId, provider),
      GetStreamPlayback: ({ malId, provider, episodeId, audio, serverId }) =>
        streamingService.getPlayback(
          malId,
          provider,
          episodeId,
          audio,
          serverId
        ),
    })
  })
).pipe(Layer.provide(StreamingService.layer))
