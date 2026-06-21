import { Atom } from "@effect-atom/atom-react"
import type {
  ExternalListProvider,
  LibraryEntry,
  LibraryPage,
  LibrarySort,
  LibraryStatus,
  LibrarySyncEventPage,
  LibrarySyncRetryTarget,
} from "@workspace/domain"
import { KaiserRpcClient } from "@workspace/rpc/client"
import * as Effect from "effect/Effect"
import { rpcRuntime } from "../../lib/rpc-client"

export const libraryPageAtom = Atom.family(
  (input: {
    status?: LibraryStatus
    sort: LibrarySort
    page: number
    perPage: number
  }) =>
    rpcRuntime.atom(
      Effect.gen(function* () {
        const client = yield* KaiserRpcClient
        return yield* client.GetLibraryPage(input)
      })
    )
)

export const libraryEntryAtom = Atom.family((malId: number) =>
  rpcRuntime.atom(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.GetLibraryEntry({ malId })
    })
  )
)

export const syncEventsAtom = Atom.family(
  (input: {
    page: number
    perPage: number
    status?: "pending" | "running" | "completed" | "failed" | "superseded"
    provider?: ExternalListProvider
  }) =>
    rpcRuntime.atom(
      Effect.gen(function* () {
        const client = yield* KaiserRpcClient
        return yield* client.ListLibrarySyncEvents(input)
      })
    )
)

export const upsertLibraryAtom = rpcRuntime.fn(
  (input: {
    anime: LibraryEntry["anime"]
    status: LibraryStatus
    score: number | null
    progress: number
    notes: string | null
  }) =>
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.UpsertLibraryEntry(input)
    })
)

export const removeLibraryAtom = rpcRuntime.fn(
  (input: { malId: number; providers: ReadonlyArray<ExternalListProvider> }) =>
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.RemoveLibraryEntry(input)
    })
)

export const clearLibraryAtom = rpcRuntime.fn(() =>
  Effect.gen(function* () {
    const client = yield* KaiserRpcClient
    return yield* client.ClearLibrary()
  })
)

export const retrySyncAtom = rpcRuntime.fn(
  (input: {
    eventIds: ReadonlyArray<string>
    target: typeof LibrarySyncRetryTarget.Type
  }) =>
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.RetryLibrarySyncEvents(input)
    })
)

export type { LibraryPage, LibrarySyncEventPage }
