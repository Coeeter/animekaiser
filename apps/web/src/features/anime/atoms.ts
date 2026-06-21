import { Atom } from "@effect-atom/atom-react"
import type {
  AnimeDetail,
  AnimeDiscoveryCategory,
  AnimeHome,
  AnimePage,
} from "@workspace/domain"
import { KaiserRpcClient } from "@workspace/rpc/client"
import * as Effect from "effect/Effect"
import { rpcRuntime } from "../../lib/rpc-client"

export type CatalogInput = Parameters<
  Effect.Effect.Success<typeof KaiserRpcClient>["ListAnimeCatalog"]
>[0]

export const homeAtom = Atom.family((initialValue?: AnimeHome) => {
  const effect = Effect.gen(function* () {
    const client = yield* KaiserRpcClient
    return yield* client.GetAnimeHome()
  })
  return rpcRuntime.atom(effect, { initialValue })
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
    return rpcRuntime.atom(effect, { initialValue })
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
    return rpcRuntime.atom(effect, { initialValue })
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
    return rpcRuntime.atom(effect, { initialValue })
  }
)

export const detailAtom = Atom.family(
  ({ malId, initialValue }: { malId: number; initialValue?: AnimeDetail }) => {
    const effect = Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.GetAnimeDetail({ malId })
    })
    return rpcRuntime.atom(effect, { initialValue })
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
