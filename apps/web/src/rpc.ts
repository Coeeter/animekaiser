import { Atom } from "@effect-atom/atom-react"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { RpcClient, RpcSerialization } from "@effect/rpc"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import { apiUrl } from "./auth"

const fetchLive = FetchHttpClient.layer.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" })
  )
)

export const makeRpcProtocol = (cookie?: string) =>
  RpcClient.layerProtocolHttp({
    url: new URL("/rpc", apiUrl).toString(),
    transformClient: cookie
      ? (client) =>
          HttpClient.mapRequest(
            client,
            HttpClientRequest.setHeader("cookie", cookie)
          )
      : undefined,
  }).pipe(Layer.provide([fetchLive, RpcSerialization.layerNdjson]))

export const rpcRuntime = Atom.runtime(makeRpcProtocol())

export const runRpc = <TResult, TError>(
  effect: Effect.Effect<TResult, TError, RpcClient.Protocol | Scope.Scope>
) =>
  Effect.runPromise(
    Effect.scoped(effect.pipe(Effect.provide(makeRpcProtocol())))
  )
