import { createServerFn } from "@tanstack/react-start"
import type { AppSession } from "@workspace/domain"
import { KaiserRpcClient } from "@workspace/rpc/client"
import * as Effect from "effect/Effect"
import { runServerRpc } from "./server-rpc"

export type { AppSession }

export const getAppSession = createServerFn({ method: "GET" }).handler(() =>
  runServerRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.GetCurrentSession()
    })
  )
)
