import { RpcSerialization, RpcServer } from "@effect/rpc"
import { KaiserRpcs } from "@workspace/domain"
import * as Layer from "effect/Layer"
import { AnimeHandlersLive } from "./server/anime"
import {
  AuthHandlersLive,
  AuthenticationMiddlewareLive,
} from "./server/authentication"
import { IntegrationHandlersLive } from "./server/integrations"
import { LibraryHandlersLive } from "./server/library"
import { ProfileHandlersLive } from "./server/profile"

export { RpcServerConfig } from "./server/config"

const HandlersLive = Layer.mergeAll(
  AnimeHandlersLive,
  AuthHandlersLive,
  IntegrationHandlersLive,
  LibraryHandlersLive,
  ProfileHandlersLive
)

export const RpcLive = RpcServer.layerHttpRouter({
  group: KaiserRpcs,
  path: "/rpc",
  protocol: "http",
}).pipe(
  Layer.provide(Layer.mergeAll(HandlersLive, AuthenticationMiddlewareLive)),
  Layer.provide(RpcSerialization.layerNdjson)
)
