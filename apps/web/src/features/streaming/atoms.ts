import type { StreamAudio, StreamProviderId } from "@animekaiser/domain"
import { Atom } from "@effect-atom/atom-react"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import { KaiserRpcClient } from "../../services/api-clients"
import { libraryProgressOf } from "../library/atoms"
import { preferredAudio, watchAction } from "./player-format"

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

export type WatchTarget = {
  malId: number
  provider: StreamProviderId
  episodeId: string
  audio: StreamAudio
  label: "Start Watching" | "Continue Watching" | "Rewatch Anime"
}

type WatchTargetKey = {
  readonly malId: number
  readonly provider: StreamProviderId
}

const watchTargetFamily = Atom.family(
  ({ malId, provider: preferredProvider }: WatchTargetKey) =>
    Atom.make((get) =>
      Effect.gen(function* () {
        const catalog = yield* get.result(
          streamEpisodesAtom(malId, preferredProvider)
        )
        const libraryProgress = yield* libraryProgressOf(get, malId)

        const provider = catalog.providers.find(
          (item) => item.status === "available" && item.episodes.length > 0
        )

        const episodes = Array.from(provider?.episodes ?? []).sort(
          (left, right) => left.number - right.number
        )

        const action = watchAction(
          libraryProgress,
          episodes.map((item) => item.number)
        )

        const episode = action
          ? episodes.find((item) => item.number === action.episodeNumber)
          : undefined

        const audio = episode ? preferredAudio(episode) : null

        return provider && action && episode && audio
          ? ({
              malId,
              provider: provider.provider,
              episodeId: episode.id,
              audio,
              label: action.label,
            } satisfies WatchTarget)
          : null
      })
    )
)

export const watchTargetAtom = (key: WatchTargetKey) =>
  watchTargetFamily(Data.struct(key))
