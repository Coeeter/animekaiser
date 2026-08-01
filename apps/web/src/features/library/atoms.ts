import type {
  ExternalListProvider,
  LibraryPage,
  LibrarySort,
  LibraryStatus,
  LibrarySyncEventPage,
  LibrarySyncStatus,
} from "@animekaiser/domain"
import * as Reactivity from "@effect/experimental/Reactivity"
import type { Atom } from "@effect-atom/atom-react"
import * as Effect from "effect/Effect"
import { KaiserRpcClient } from "../../services/api-clients"
import { profileReactivityKeys } from "../profile/atoms"

export const libraryReactivityKeys = {
  all: "library",
  entry: (malId: number) => `library-entry:${malId}`,
  sync: "library-sync",
}

export const libraryGlobalMutationKeys = [
  libraryReactivityKeys.all,
  libraryReactivityKeys.sync,
  ...profileReactivityKeys,
]

export const libraryMutationKeys = (malId: number) => [
  ...libraryGlobalMutationKeys,
  libraryReactivityKeys.entry(malId),
]

export const libraryPageAtom = (
  status: LibraryStatus | undefined,
  sort: LibrarySort,
  page: number,
  perPage: number,
  query?: string
) =>
  KaiserRpcClient.query(
    "GetLibraryPage",
    { status, sort, page, perPage, query },
    { reactivityKeys: [libraryReactivityKeys.all] }
  )

export const libraryEntryAtom = (malId: number) =>
  KaiserRpcClient.query(
    "GetLibraryEntry",
    { malId },
    { reactivityKeys: [libraryReactivityKeys.entry(malId)] }
  )

export const libraryProgressOf = (get: Atom.Context, malId: number) =>
  get.result(libraryEntryAtom(malId)).pipe(
    Effect.map((entry) => entry?.progress ?? null),
    Effect.orElseSucceed(() => null)
  )

export const syncEventsAtom = (
  page: number,
  perPage: number,
  status?: typeof LibrarySyncStatus.Type,
  provider?: ExternalListProvider
) =>
  KaiserRpcClient.query(
    "ListLibrarySyncEvents",
    { page, perPage, status, provider },
    { reactivityKeys: [libraryReactivityKeys.sync] }
  )

// Entries land long after `StartLibraryImport` resolves, so mutation keys miss them.
export const invalidateLibraryAtom = KaiserRpcClient.runtime.fn<void>()(() =>
  Reactivity.invalidate(libraryGlobalMutationKeys)
)

export const upsertLibraryAtom = KaiserRpcClient.mutation("UpsertLibraryEntry")

export const removeLibraryAtom = KaiserRpcClient.mutation("RemoveLibraryEntry")

export const clearLibraryAtom = KaiserRpcClient.mutation("ClearLibrary")

export const retrySyncAtom = KaiserRpcClient.mutation("RetryLibrarySyncEvents")

export const startLibraryImportAtom =
  KaiserRpcClient.mutation("StartLibraryImport")

export const watchLibraryImportAtom = (id: string) =>
  KaiserRpcClient.query("WatchLibraryImport", { id })

export type { LibraryPage, LibrarySyncEventPage }
