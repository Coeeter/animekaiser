import { KaiserRpcs } from "@animekaiser/domain"
import { RpcSerialization, RpcServer } from "@effect/rpc"
import * as Layer from "effect/Layer"
import { AnimeHandlersLive } from "./server/anime"
import {
  AuthenticationMiddlewareLive,
  AuthHandlersLive,
} from "./server/authentication"
import { WatchHistoryHandlersLive } from "./server/history"
import { IntegrationHandlersLive } from "./server/integrations"
import { LibraryHandlersLive } from "./server/library"
import { RpcRequestLogging, RpcRequestLoggingLive } from "./server/logging"
import { ProfileHandlersLive } from "./server/profile"
import { RecommendationHandlersLive } from "./server/recommendations"
import { RoomAuthenticationLive, RoomHandlersLive } from "./server/rooms"
import { SocialHandlersLive } from "./server/social"
import { StreamingHandlersLive } from "./server/streaming"

export { RpcServerConfig } from "./server/config"

const HandlersLive = Layer.mergeAll(
  AnimeHandlersLive,
  AuthHandlersLive,
  IntegrationHandlersLive,
  LibraryHandlersLive,
  ProfileHandlersLive,
  RecommendationHandlersLive,
  RoomHandlersLive,
  SocialHandlersLive,
  StreamingHandlersLive,
  WatchHistoryHandlersLive
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
      RoomAuthenticationLive,
      RpcRequestLoggingLive
    )
  ),
  Layer.provide(RpcSerialization.layerNdjson)
)
