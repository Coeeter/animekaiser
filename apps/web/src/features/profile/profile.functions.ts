import { KaiserRpcClient } from "@workspace/rpc/client"
import * as Effect from "effect/Effect"
import { runRpc } from "../../lib/rpc-client"

export const getOwnProfile = () =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.GetOwnProfile()
    })
  )

export const getPublicProfile = (username: string) =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.GetPublicProfile({ username })
    })
  )
