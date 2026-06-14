import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform"
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import { Database } from "@workspace/db"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import { ApiLive } from "./api"
import { Env } from "./env"

const DBLive = Layer.unwrapEffect(
  Env.pipe(
    Effect.map((env) =>
      Database.layer({ url: env.DATABASE_URL, ssl: env.ENV === "prod" })
    )
  )
).pipe(Layer.provide(Env.Default))

const DBListenerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const db = yield* Database
    return yield* db.setupConnectionListeners
  })
)

const CorsLive = Layer.unwrapEffect(
  Env.pipe(
    Effect.map((env) =>
      HttpApiBuilder.middlewareCors({
        allowedOrigins: [env.APP_URL],
        allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
      })
    )
  )
)

const HttpServerLayer = Layer.unwrapEffect(
  Env.pipe(Effect.map((env) => BunHttpServer.layer({ port: env.PORT })))
)

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  HttpServer.withLogAddress,
  Layer.provide(CorsLive),
  Layer.provide(ApiLive),
  Layer.merge(DBListenerLive),
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
