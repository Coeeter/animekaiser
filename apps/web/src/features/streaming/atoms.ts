import type {
  AnimeItem,
  StreamAudio,
  StreamProviderId,
} from "@animekaiser/domain"
import { Atom, Result } from "@effect-atom/atom-react"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import { KaiserRpcClient } from "../../services/api-clients"
import { watchOrderAtom } from "../anime/detail/atoms"
import { libraryProgressOf } from "../library/atoms"
import { preferredAudio, watchAction } from "./player-format"
import { playerPreferencesAtom, preferredProviderAtom } from "./preferences"

export const streamProvidersAtom = KaiserRpcClient.query(
  "ListStreamProviders",
  undefined,
  { timeToLive: "1 hour" }
)

export const providerLabelAtom = Atom.family((provider: StreamProviderId) =>
  Atom.make((get) => {
    const providers = get(streamProvidersAtom)
    return Result.isSuccess(providers)
      ? (providers.value.find((item) => item.id === provider)?.label ??
          provider)
      : provider
  })
)

export const streamAvailabilityAtom = (malId: number) =>
  KaiserRpcClient.query(
    "ListStreamAvailability",
    { malId },
    { timeToLive: "10 minutes" }
  )

export const streamEpisodesAtom = (
  malId: number,
  provider?: StreamProviderId
) =>
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
  readonly provider?: StreamProviderId
}

const watchTargetFamily = Atom.family(
  ({ malId, provider: preferredProvider }: WatchTargetKey) =>
    Atom.make((get) =>
      Effect.gen(function* () {
        const preferences = get(playerPreferencesAtom)
        const catalog = yield* get.result(
          streamEpisodesAtom(
            malId,
            preferredProvider ?? get(preferredProviderAtom)
          )
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

        const audio = episode
          ? preferredAudio(episode, preferences.preferredAudio)
          : null

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

export type NextSeason = {
  readonly anime: AnimeItem
  readonly target: WatchTarget
}

type NextSeasonKey = {
  readonly malId: number
  readonly provider: StreamProviderId
}

// The entry after this one in the franchise's watch order, resolved to a
// playable episode, preferring the provider already in use.
const nextSeasonFamily = Atom.family(({ malId, provider }: NextSeasonKey) =>
  Atom.make((get) =>
    Effect.gen(function* () {
      const order = yield* get.result(watchOrderAtom(malId))
      const index = order.entries.findIndex((entry) => entry.malId === malId)
      const anime = index === -1 ? undefined : order.entries[index + 1]
      if (!anime || anime.status === "NOT_YET_RELEASED") return null
      const target =
        (yield* get.result(
          watchTargetAtom({ malId: anime.malId, provider })
        )) ?? (yield* get.result(watchTargetAtom({ malId: anime.malId })))
      return target ? ({ anime, target } satisfies NextSeason) : null
    })
  )
)

export const nextSeasonAtom = (key: NextSeasonKey) =>
  nextSeasonFamily(Data.struct(key))
