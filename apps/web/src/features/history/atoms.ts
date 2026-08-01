import type { StreamProviderId } from "@animekaiser/domain"
import { Atom } from "@effect-atom/atom-react"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import { KaiserRpcClient } from "../../services/api-clients"
import { libraryProgressOf } from "../library/atoms"
import { profileReactivityKeys } from "../profile/atoms"
import { streamEpisodesAtom } from "../streaming/atoms"
import { episodeProgressByNumber } from "./episode-progress"

export const watchHistoryReactivityKeys = {
  all: "watch-history",
}

// Kept off `recordWatchProgress`, which fires every few seconds.
export const watchHistoryClearKeys = [
  watchHistoryReactivityKeys.all,
  ...profileReactivityKeys,
]

export const continueWatchingAtom = (limit: number) =>
  KaiserRpcClient.query(
    "ListContinueWatching",
    { limit },
    { reactivityKeys: [watchHistoryReactivityKeys.all] }
  )

export const watchHistoryPageAtom = (
  page: number,
  perPage: number,
  query?: string
) =>
  KaiserRpcClient.query(
    "ListWatchHistory",
    { page, perPage, query },
    { reactivityKeys: [watchHistoryReactivityKeys.all] }
  )

export const episodeWatchProgressAtom = (malId: number, episode: number) =>
  KaiserRpcClient.query(
    "GetEpisodeWatchProgress",
    { malId, episode },
    { reactivityKeys: [watchHistoryReactivityKeys.all] }
  )

export const animeWatchProgressAtom = (malId: number) =>
  KaiserRpcClient.query(
    "ListAnimeWatchProgress",
    { malId },
    { reactivityKeys: [watchHistoryReactivityKeys.all] }
  )

type EpisodeProgressKey = {
  readonly malId: number
  readonly provider: StreamProviderId
}

const episodeProgressFamily = Atom.family(
  ({ malId, provider }: EpisodeProgressKey) =>
    Atom.make((get) =>
      Effect.gen(function* () {
        const catalog = yield* get.result(streamEpisodesAtom(malId, provider))

        const entries = yield* get
          .result(animeWatchProgressAtom(malId))
          .pipe(Effect.orElseSucceed(() => []))

        const libraryProgress = yield* libraryProgressOf(get, malId)

        const episodes =
          catalog.providers.find((item) => item.provider === provider)
            ?.episodes ?? []

        return episodeProgressByNumber({
          episodeNumbers: episodes.map((episode) => episode.number),
          entries,
          libraryProgress,
        })
      })
    )
)

export const episodeProgressAtom = (key: EpisodeProgressKey) =>
  episodeProgressFamily(Data.struct(key))

export const recordWatchProgressAtom = KaiserRpcClient.mutation(
  "RecordWatchProgress"
)

export const clearWatchHistoryEntryAtom = KaiserRpcClient.mutation(
  "ClearWatchHistoryEntry"
)

export const clearWatchHistoryAtom =
  KaiserRpcClient.mutation("ClearWatchHistory")
