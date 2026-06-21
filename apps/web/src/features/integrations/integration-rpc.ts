import type { ExternalListProvider } from "@workspace/domain"
import { KaiserRpcClient } from "@workspace/rpc/client"
import * as Effect from "effect/Effect"
import { runRpc } from "../../lib/rpc-client"

export const loadExternalAccounts = () =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.ListExternalListAccounts()
    })
  )

export const disconnectExternalAccount = (provider: ExternalListProvider) =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.DisconnectExternalListAccount({ provider })
    })
  )
