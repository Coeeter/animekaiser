import type { AppSession } from "@workspace/domain"
import { KaiserRpcClient } from "@workspace/rpc/client"
import * as Effect from "effect/Effect"
import { runRpc } from "./rpc-client"

export type { AppSession }

export const getAppSession = () =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.GetCurrentSession()
    })
  )
