import { fileURLToPath } from "node:url"
import { RecommendationService, RoomService } from "@animekaiser/core"
import { RpcLive } from "@animekaiser/rpc/server"
import * as HttpLayerRouter from "@effect/platform/HttpLayerRouter"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as Layer from "effect/Layer"
import { BetterAuthLive, ExternalListOAuthConfigLive } from "./auth"
import { Env } from "./env"
import { DatabaseListenerLive, makeDatabaseLive } from "./infra/database"
import { CorsLive, HttpServerLive } from "./infra/http"
import { MalApiConfigLive } from "./infra/mal"
import { OpenRouterLive } from "./infra/openrouter"
import { ProfileMediaStorageLive } from "./infra/profile-media"
import { RedisKeyValueStoreLive } from "./infra/redis"
import { RpcServerConfigLive } from "./infra/rpc"
import { StreamingClientLive } from "./infra/streaming"
import { AuthRoutesLive } from "./routes/auth"
import { ExternalListAccountsRoutesLive } from "./routes/external-lists"
import { RoomRoutesLive } from "./routes/rooms"
import { AiringSyncWorkerLive } from "./workers/airing-sync"
import { LibraryImportWorkerLive } from "./workers/library-import"
import { LibrarySyncWorkerLive } from "./workers/library-sync"
import { RoomLifecycleWorkerLive } from "./workers/rooms"
import { ExternalListTokenRefreshWorkerLive } from "./workers/token-refresh"

const RoutesLive = Layer.mergeAll(
  AuthRoutesLive,
  ExternalListAccountsRoutesLive,
  RoomRoutesLive,
  RpcLive,
  CorsLive
)

const migrationsFolder = fileURLToPath(
  new URL("../../../packages/db/drizzle", import.meta.url)
)

export const ApiLive = HttpLayerRouter.serve(RoutesLive, {
  middleware: HttpMiddleware.logger,
}).pipe(
  Layer.merge(DatabaseListenerLive),
  Layer.merge(LibraryImportWorkerLive),
  Layer.merge(LibrarySyncWorkerLive),
  Layer.merge(ExternalListTokenRefreshWorkerLive),
  Layer.merge(AiringSyncWorkerLive),
  Layer.merge(RoomLifecycleWorkerLive),
  Layer.provideMerge(ProfileMediaStorageLive),
  Layer.provideMerge(RpcServerConfigLive),
  Layer.provideMerge(ExternalListOAuthConfigLive),
  Layer.provideMerge(BetterAuthLive),
  Layer.provide(RecommendationService.Default),
  Layer.provide(OpenRouterLive),
  Layer.provide(RoomService.Default),
  Layer.provide(StreamingClientLive),
  Layer.provide(MalApiConfigLive),
  Layer.provide(RedisKeyValueStoreLive),
  Layer.provide(makeDatabaseLive(migrationsFolder)),
  Layer.provide(HttpServerLive),
  Layer.provide(Env.Default)
)
