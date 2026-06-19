import { Atom } from "@effect-atom/atom-react"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { RpcClient, RpcSerialization } from "@effect/rpc"
import { KaiserRpcClient } from "@workspace/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

const apiUrl = import.meta.env.VITE_API_URL
if (!apiUrl) throw new Error("Missing VITE_API_URL")

const RpcProtocolLive = RpcClient.layerProtocolHttp({
  url: new URL("/rpc", apiUrl).toString(),
}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]))

const rpcRuntime = Atom.runtime(RpcProtocolLive)

export const pingAtom = rpcRuntime.atom(
  Effect.gen(function* () {
    const client = yield* KaiserRpcClient
    return yield* client.Ping()
  })
)
