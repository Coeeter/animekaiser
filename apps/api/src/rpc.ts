import { RpcSerialization, RpcServer } from "@effect/rpc"
import { KaiserRpcs } from "@workspace/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

const HandlersLive = KaiserRpcs.toLayer(
  Effect.succeed({ Ping: () => Effect.succeed("pong" as const) })
)

export const RpcLive = RpcServer.layerHttpRouter({
  group: KaiserRpcs,
  path: "/rpc",
  protocol: "http",
}).pipe(
  Layer.provide(HandlersLive),
  Layer.provide(RpcSerialization.layerNdjson)
)
