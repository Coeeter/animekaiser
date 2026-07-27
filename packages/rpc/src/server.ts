import { KaiserRpcs } from "@animekaiser/domain"
import { RpcSerialization, RpcServer } from "@effect/rpc"
import * as Layer from "effect/Layer"
import { AnimeHandlersLive } from "./server/anime"
import {
  AuthenticationMiddlewareLive,
  AuthHandlersLive,
} from "./server/authentication"
import { IntegrationHandlersLive } from "./server/integrations"
import { LibraryHandlersLive } from "./server/library"
import { RpcRequestLogging, RpcRequestLoggingLive } from "./server/logging"
import { ProfileHandlersLive } from "./server/profile"
import { StreamingHandlersLive } from "./server/streaming"

export { RpcServerConfig } from "./server/config"

const HandlersLive = Layer.mergeAll(
  AnimeHandlersLive,
  AuthHandlersLive,
  IntegrationHandlersLive,
  LibraryHandlersLive,
  ProfileHandlersLive,
  StreamingHandlersLive
)

const ServerRpcs = KaiserRpcs.middleware(RpcRequestLogging)

export const RpcLive = RpcServer.layerHttpRouter({
  group: ServerRpcs,
  path: "/rpc",
  protocol: "websocket",
}).pipe(
  Layer.provide(
    Layer.mergeAll(
      HandlersLive,
      AuthenticationMiddlewareLive,
      RpcRequestLoggingLive
    )
  ),
  Layer.provide(RpcSerialization.layerNdjson)
)
