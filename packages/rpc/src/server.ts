import { RpcSerialization, RpcServer } from "@effect/rpc"
import { KaiserRpcs } from "@workspace/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { AnimeHandlersLive } from "./server/anime"
import { IntegrationHandlersLive } from "./server/integrations"
import { LibraryHandlersLive } from "./server/library"
import { ProfileHandlersLive } from "./server/profile"

export { RpcServerConfig } from "./server/config"

const PingHandlerLive = KaiserRpcs.toLayerHandler("Ping", () => Effect.succeed("pong" as const))

const HandlersLive = Layer.mergeAll(
  PingHandlerLive,
  AnimeHandlersLive,
  IntegrationHandlersLive,
  LibraryHandlersLive,
  ProfileHandlersLive
)

export const RpcLive = RpcServer.layerHttpRouter({
  group: KaiserRpcs,
  path: "/rpc",
  protocol: "http",
}).pipe(
  Layer.provide(HandlersLive),
  Layer.provide(RpcSerialization.layerNdjson)
)
