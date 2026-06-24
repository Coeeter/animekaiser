import { KaiserRpcClient } from "@workspace/rpc/client"
import * as Effect from "effect/Effect"
import { runRpc } from "../../lib/rpc-client"

export type CatalogInput = Parameters<
  Effect.Effect.Success<typeof KaiserRpcClient>["ListAnimeCatalog"]
>[0]

export const loadAnimeHome = () =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.GetAnimeHome()
    })
  )

export const loadAnimeCatalog = (input: CatalogInput) =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.ListAnimeCatalog(input)
    })
  )

export const loadAnimeDiscovery = (
  category: "trending" | "seasonal" | "popular" | "topRated" | "upcoming",
  page: number
) =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.ListAnimeDiscovery({ category, page, perPage: 12 })
    })
  )

export const loadAnimeSchedule = (from: number, to: number) =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.ListAnimeSchedule({
        from,
        to,
        page: 1,
        perPage: 50,
      })
    })
  )

export const loadAnimeDetail = (malId: number) =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.GetAnimeDetail({ malId })
    })
  )

export const loadRandomAnime = () =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.GetRandomAnime()
    })
  )
