import * as HttpLayerRouter from "@effect/platform/HttpLayerRouter"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import { RpcLive } from "@workspace/rpc/server"
import * as Layer from "effect/Layer"
import { BetterAuthLive, ExternalListOAuthConfigLive } from "./auth"
import { Env } from "./env"
import { DatabaseListenerLive, DatabaseLive } from "./infra/database"
import { CorsLive, HttpServerLive } from "./infra/http"
import { ProfileMediaStorageLive } from "./infra/profile-media"
import { RedisKeyValueStoreLive } from "./infra/redis"
import { RpcServerConfigLive } from "./infra/rpc"
import { AuthRoutesLive } from "./routes/auth"
import { ExternalListAccountsRoutesLive } from "./routes/external-lists"
import { LibraryImportWorkerLive } from "./workers/library-import"
import { LibrarySyncWorkerLive } from "./workers/library-sync"
import { ExternalListTokenRefreshWorkerLive } from "./workers/token-refresh"

const RoutesLive = Layer.mergeAll(
  AuthRoutesLive,
  ExternalListAccountsRoutesLive,
  RpcLive,
  CorsLive
)

export const ApiLive = HttpLayerRouter.serve(RoutesLive, {
  middleware: HttpMiddleware.logger,
}).pipe(
  Layer.merge(DatabaseListenerLive),
  Layer.merge(LibraryImportWorkerLive),
  Layer.merge(LibrarySyncWorkerLive),
  Layer.merge(ExternalListTokenRefreshWorkerLive),
  Layer.provideMerge(ProfileMediaStorageLive),
  Layer.provideMerge(RpcServerConfigLive),
  Layer.provideMerge(ExternalListOAuthConfigLive),
  Layer.provideMerge(BetterAuthLive),
  Layer.provide(RedisKeyValueStoreLive),
  Layer.provide(DatabaseLive),
  Layer.provide(HttpServerLive),
  Layer.provide(Env.Default)
)
