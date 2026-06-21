import { KaiserRpcClient } from "@workspace/rpc/client"
import * as Effect from "effect/Effect"
import { rpcRuntime } from "../../lib/rpc-client"

export const accountHealthAtom = rpcRuntime.atom(
  Effect.gen(function* () {
    const client = yield* KaiserRpcClient
    return yield* client.ListExternalListAccounts()
  })
)
