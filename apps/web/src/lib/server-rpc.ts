import type { RpcClient } from "@effect/rpc"
import { getRequestHeaders } from "@tanstack/react-start/server"
import type * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"
import { runRpc } from "./rpc-client"

export const runServerRpc = <TResult, TError>(
  effect: Effect.Effect<TResult, TError, RpcClient.Protocol | Scope.Scope>
) => runRpc(effect, getRequestHeaders().get("cookie") ?? "")
