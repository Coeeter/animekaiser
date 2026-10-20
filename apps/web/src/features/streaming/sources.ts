import type {
  StreamAudio,
  StreamEpisode,
  StreamProviderId,
} from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import * as Atom from "effect/reactivity/Atom"
import { KaiserRpcClient } from "../../services/api-clients"
import { streamEpisodesAtom } from "./atoms"
import { matchingSourceEpisode } from "./source-selection"

export type SourceChoice = {
  provider: StreamProviderId
  episode: StreamEpisode
  audio: StreamAudio
  serverId?: string
}

export const sourceEpisodeAtom = Atom.family(
  (key: {
    readonly malId: number
    readonly provider: StreamProviderId
    readonly number: number
    readonly audio: StreamAudio
  }) =>
    Atom.make((get) =>
      Effect.gen(function* () {
        const catalog = yield* get.result(
          streamEpisodesAtom(key.malId, key.provider)
        )
        return matchingSourceEpisode(
          catalog.providers.find((entry) => entry.provider === key.provider),
          key.number,
          key.audio
        )
      })
    )
)

export const nextSourceAtom = KaiserRpcClient.runtime.fn(
  Effect.fnUntraced(function* (input: {
    malId: number
    number: number
    audio: StreamAudio
    tried: ReadonlyArray<StreamProviderId>
  }) {
    const client = yield* KaiserRpcClient
    const providers = yield* client("ListStreamProviders", undefined)
    for (const provider of providers) {
      if (input.tried.includes(provider.id)) continue
      const choice = yield* Effect.gen(function* () {
        const catalog = yield* client("ListStreamEpisodes", {
          malId: input.malId,
          provider: provider.id,
        })
        const episode = matchingSourceEpisode(
          catalog.providers.find((entry) => entry.provider === provider.id),
          input.number,
          input.audio
        )
        if (!episode) return null
        yield* client("GetStreamPlayback", {
          malId: input.malId,
          provider: provider.id,
          episodeId: episode.id,
          audio: input.audio,
        })
        return {
          provider: provider.id,
          episode,
          audio: input.audio,
        } satisfies SourceChoice
      }).pipe(Effect.orElseSucceed(() => null))
      if (choice) return choice
    }
    return null
  })
)
