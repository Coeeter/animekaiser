import type {
  ContinueWatchingItem,
  LibraryNewEpisode,
  LibraryNextSeason,
  StreamProviderId,
} from "@animekaiser/domain"
import { Atom, Result } from "@effect-atom/atom-react"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import { KaiserRpcClient } from "../../services/api-clients"
import {
  libraryNextSeasonsAtom,
  libraryProgressOf,
  watchingNewEpisodesAtom,
} from "../library/atoms"
import { profileReactivityKeys } from "../profile/atoms"
import { streamEpisodesAtom } from "../streaming/atoms"
import { spoilerBlurAtom } from "../streaming/preferences"
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
  | { readonly kind: "nextSeason"; readonly item: LibraryNextSeason }

// A show mid-episode resumes from history; otherwise the library's next aired
// episode stands in, then the next entry of a recently finished franchise, so
// each show appears once.
export const continueRowAtom = Atom.make((get) =>
  Effect.gen(function* () {
    const history = yield* get.result(continueWatchingAtom(12))
    const upNext = yield* get
      .result(watchingNewEpisodesAtom)
      .pipe(Effect.orElseSucceed((): ReadonlyArray<LibraryNewEpisode> => []))
    const nextSeasons = yield* get
      .result(libraryNextSeasonsAtom)
      .pipe(Effect.orElseSucceed((): ReadonlyArray<LibraryNextSeason> => []))
    const resumed = new Set(history.map((item) => item.malId))
    const nextItems = upNext.filter((item) => !resumed.has(item.anime.malId))
    const shown = new Set([
      ...resumed,
      ...nextItems.map((item) => item.anime.malId),
    ])
    return [
      ...history.map((item): ContinueRowItem => ({ kind: "resume", item })),
      ...nextItems.map((item): ContinueRowItem => ({ kind: "next", item })),
      ...nextSeasons
        .filter((item) => !shown.has(item.next.malId))
        .map((item): ContinueRowItem => ({ kind: "nextSeason", item })),
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

type EpisodeSpoilerKey = EpisodeProgressKey & { readonly number: number }

// Episodes stay hidden while progress is still loading, so a spoiler never
// flashes before the watched state arrives.
const episodeSpoilerFamily = Atom.family(
  ({ malId, provider, number }: EpisodeSpoilerKey) =>
    Atom.make((get) => {
      if (!get(spoilerBlurAtom)) return false
      const progress = get(episodeProgressAtom({ malId, provider }))
      if (!Result.isSuccess(progress)) return true
      const state = progress.value.get(number)
      return !(state?.watched || state?.continueWatching)
    })
)

export const episodeSpoilerAtom = (key: EpisodeSpoilerKey) =>
  episodeSpoilerFamily(Data.struct(key))

export const recordWatchProgressAtom = KaiserRpcClient.mutation(
  "RecordWatchProgress"
)

export const clearWatchHistoryEntryAtom = KaiserRpcClient.mutation(
  "ClearWatchHistoryEntry"
)

export const clearWatchHistoryAtom =
  KaiserRpcClient.mutation("ClearWatchHistory")
