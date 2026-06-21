import * as BunHttpServer from "@effect/platform-bun/BunHttpServer"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as HttpLayerRouter from "@effect/platform/HttpLayerRouter"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import { Database } from "@workspace/db"
import { RpcLive, RpcServerConfig } from "@workspace/rpc/server"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import { BetterAuthLive, ExternalListOAuthConfigLive } from "./auth"
import { AuthRoutesLive } from "./auth/routes"
import { AnimeCacheLive } from "./cache"
import { Env } from "./env"
import { ExternalListOAuthStateStoreLive } from "./external-list/oauth-state-store"
import { ExternalListAccountsRoutesLive } from "./external-list/routes"
import { LibraryImportWorkerLive } from "./external-list/import-worker"
import { ExternalListTokenRefreshWorkerLive } from "./external-list/token-refresh"
import { LibrarySyncWorkerLive } from "./external-list/sync-worker"
import { ProfileMediaStorageLive } from "./profile/storage"

const DBLive = Layer.unwrapEffect(
  Env.pipe(
    Effect.map((env) =>
      Database.layer({
        url: env.database.url,
        ssl: env.server.env === "prod",
      })
    )
  )
).pipe(Layer.provide(Env.Default))

const DBListenerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const db = yield* Database
    return yield* db.setupConnectionListeners
  })
)

const RpcServerConfigLive = Layer.effect(
  RpcServerConfig,
  Env.pipe(
    Effect.map((env) => ({
      appUrl: env.app.url,
      mediaPublicUrl: env.r2.publicUrl,
    }))
  )
)

const CorsLive = Layer.unwrapEffect(
  Env.pipe(
    Effect.map((env) =>
      HttpLayerRouter.cors({
        allowedOrigins: [env.app.url],
        allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "b3",
          "traceparent",
          "tracestate",
          "x-b3-traceid",
          "x-b3-spanid",
          "x-b3-sampled",
        ],
        credentials: true,
      })
    )
  )
)

const HttpServerLayer = Layer.unwrapEffect(
  Env.pipe(Effect.map((env) => BunHttpServer.layer({ port: env.server.port })))
)

const AllRoutesLive = Layer.mergeAll(
  AuthRoutesLive,
  ExternalListAccountsRoutesLive,
  RpcLive,
  CorsLive
)

const HttpLive = HttpLayerRouter.serve(AllRoutesLive, {
  middleware: HttpMiddleware.logger,
}).pipe(
  Layer.merge(DBListenerLive),
  Layer.merge(LibraryImportWorkerLive),
  Layer.merge(LibrarySyncWorkerLive),
  Layer.merge(ExternalListTokenRefreshWorkerLive),
  Layer.provideMerge(ProfileMediaStorageLive),
  Layer.provideMerge(AnimeCacheLive),
  Layer.provideMerge(RpcServerConfigLive),
  Layer.provideMerge(ExternalListOAuthConfigLive),
  Layer.provideMerge(ExternalListOAuthStateStoreLive),
  Layer.provideMerge(BetterAuthLive),
  Layer.provide(DBLive),
  Layer.provide(HttpServerLayer),
  Layer.provide(Env.Default)
)

Layer.launch(HttpLive).pipe(
  Effect.tapErrorCause(Effect.logError),
  Effect.retry({
    while: (error) => error._tag === "DatabaseConnectionError",
    schedule: Schedule.exponential("1 second", 2).pipe(
      Schedule.modifyDelay(Duration.min("8 seconds")),
      Schedule.jittered,
      Schedule.repetitions,
      Schedule.modifyDelayEffect((count, delay) =>
        Effect.as(
          Effect.logError(
            `[Server Crashed]: Retrying in ${Duration.format(delay)} (attempt #${count + 1})`
          ),
          delay
        )
      )
    ),
  }),
  BunRuntime.runMain()
)
