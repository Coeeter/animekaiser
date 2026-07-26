import type {
  ExternalListProvider,
  LibraryPage,
  LibrarySort,
  LibraryStatus,
  LibrarySyncEventPage,
  LibrarySyncStatus,
} from "@workspace/domain"
import {
  KaiserRpcClient,
  refreshOnAuthChange,
} from "../../services/api-clients"

export const libraryReactivityKeys = {
  all: "library",
  entry: (malId: number) => `library-entry:${malId}`,
}

export const libraryMutationKeys = (malId: number) => [
  libraryReactivityKeys.all,
  libraryReactivityKeys.entry(malId),
]

export const libraryPageAtom = (
  status: LibraryStatus | undefined,
  sort: LibrarySort,
  page: number,
  perPage: number
) =>
  refreshOnAuthChange(
    KaiserRpcClient.query(
      "GetLibraryPage",
      { status, sort, page, perPage },
      { reactivityKeys: [libraryReactivityKeys.all] }
    )
  )

export const libraryEntryAtom = (malId: number) =>
  refreshOnAuthChange(
    KaiserRpcClient.query(
      "GetLibraryEntry",
      { malId },
      { reactivityKeys: [libraryReactivityKeys.entry(malId)] }
    )
  )

export const syncEventsAtom = (
  page: number,
  perPage: number,
  status?: typeof LibrarySyncStatus.Type,
  provider?: ExternalListProvider
) =>
  refreshOnAuthChange(
    KaiserRpcClient.query("ListLibrarySyncEvents", {
      page,
      perPage,
      status,
      provider,
    })
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
