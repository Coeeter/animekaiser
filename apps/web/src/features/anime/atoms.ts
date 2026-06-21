import { Atom } from "@effect-atom/atom-react"
import type {
  AnimeDetail,
  AnimeDiscoveryCategory,
  AnimeHome,
  AnimePage,
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
import { rpcRuntime } from "../../rpc"

export type CatalogInput = Parameters<
  Effect.Effect.Success<typeof KaiserRpcClient>["ListAnimeCatalog"]
>[0]

export const homeAtom = Atom.family((initialValue?: AnimeHome) => {
  const effect = Effect.gen(function* () {
    const client = yield* KaiserRpcClient
    return yield* client.GetAnimeHome()
  })
  return initialValue === undefined
    ? rpcRuntime.atom(effect)
    : rpcRuntime.atom(effect, { initialValue })
})

export const catalogAtom = Atom.family(
  ({
    input,
    initialValue,
  }: {
    input: CatalogInput
    initialValue?: AnimePage
  }) => {
    const effect = Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.ListAnimeCatalog(input)
    })
    return initialValue === undefined
      ? rpcRuntime.atom(effect)
      : rpcRuntime.atom(effect, { initialValue })
  }
)

export const discoveryAtom = Atom.family(
  ({
    category,
    page,
    perPage,
    initialValue,
  }: {
    category: AnimeDiscoveryCategory
    page: number
    perPage: number
    initialValue?: AnimePage
  }) => {
    const effect = Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.ListAnimeDiscovery({ category, page, perPage })
    })
    return initialValue === undefined
      ? rpcRuntime.atom(effect)
      : rpcRuntime.atom(effect, { initialValue })
  }
)

export const scheduleAtom = Atom.family(
  ({
    from,
    to,
    page,
    perPage,
    initialValue,
  }: {
    from: number
    to: number
    page: number
    perPage: number
    initialValue?: AnimePage
  }) => {
    const effect = Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.ListAnimeSchedule({ from, to, page, perPage })
    })
    return initialValue === undefined
      ? rpcRuntime.atom(effect)
      : rpcRuntime.atom(effect, { initialValue })
  }
)

export const detailAtom = Atom.family(
  ({ malId, initialValue }: { malId: number; initialValue?: AnimeDetail }) => {
    const effect = Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.GetAnimeDetail({ malId })
    })
    return initialValue === undefined
      ? rpcRuntime.atom(effect)
      : rpcRuntime.atom(effect, { initialValue })
  }
)

export const recommendationsAtom = Atom.family((malId: number) =>
  rpcRuntime.atom(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.ListAnimeRecommendations({
        malId,
        page: 1,
        perPage: 12,
      })
    })
  )
)

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

export const accountHealthAtom = rpcRuntime.atom(
  Effect.gen(function* () {
    const client = yield* KaiserRpcClient
    return yield* client.ListExternalListAccounts()
  })
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

export const startImportAtom = rpcRuntime.fn((provider: ExternalListProvider) =>
  Effect.gen(function* () {
    const client = yield* KaiserRpcClient
    return yield* client.StartLibraryImport({ provider })
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
