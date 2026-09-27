import type {
  ContinueWatchingItem,
  LibraryNewEpisode,
  StreamProviderId,
} from "@animekaiser/domain"
import { Atom } from "@effect-atom/atom-react"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import { KaiserRpcClient } from "../../services/api-clients"
import { libraryProgressOf, watchingNewEpisodesAtom } from "../library/atoms"
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

export type ContinueRowItem =
  | { readonly kind: "resume"; readonly item: ContinueWatchingItem }
  | { readonly kind: "next"; readonly item: LibraryNewEpisode }

// A show mid-episode resumes from history; otherwise the library's next aired
// episode stands in, so each show appears once.
export const continueRowAtom = Atom.make((get) =>
  Effect.gen(function* () {
    const history = yield* get.result(continueWatchingAtom(12))
    const upNext = yield* get
      .result(watchingNewEpisodesAtom)
      .pipe(Effect.orElseSucceed((): ReadonlyArray<LibraryNewEpisode> => []))
    const resumed = new Set(history.map((item) => item.malId))
    return [
      ...history.map((item): ContinueRowItem => ({ kind: "resume", item })),
      ...upNext
        .filter((item) => !resumed.has(item.anime.malId))
        .map((item): ContinueRowItem => ({ kind: "next", item })),
    ]
  })
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

export const watchHistoryShowsAtom = (
  page: number,
  perPage: number,
  query?: string
) =>
  KaiserRpcClient.query(
    "ListWatchHistoryShows",
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
