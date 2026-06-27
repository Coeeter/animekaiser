import type {
  ExternalListProvider,
  LibraryPage,
  LibrarySort,
  LibraryStatus,
  LibrarySyncEventPage,
  LibrarySyncStatus,
} from "@workspace/domain"
import { KaiserAtomRpc } from "../../lib/rpc-client"

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
  KaiserAtomRpc.query(
    "GetLibraryPage",
    { status, sort, page, perPage },
    { reactivityKeys: [libraryReactivityKeys.all] }
  )

export const libraryEntryAtom = (malId: number) =>
  KaiserAtomRpc.query(
    "GetLibraryEntry",
    { malId },
    { reactivityKeys: [libraryReactivityKeys.entry(malId)] }
  )

export const syncEventsAtom = (
  page: number,
  perPage: number,
  status?: typeof LibrarySyncStatus.Type,
  provider?: ExternalListProvider
) =>
  KaiserAtomRpc.query("ListLibrarySyncEvents", {
    page,
    perPage,
    status,
    provider,
  })

export const upsertLibraryAtom = KaiserAtomRpc.mutation("UpsertLibraryEntry")

export const removeLibraryAtom = KaiserAtomRpc.mutation("RemoveLibraryEntry")

export const clearLibraryAtom = KaiserAtomRpc.mutation("ClearLibrary")

export const retrySyncAtom = KaiserAtomRpc.mutation("RetryLibrarySyncEvents")

export type { LibraryPage, LibrarySyncEventPage }
