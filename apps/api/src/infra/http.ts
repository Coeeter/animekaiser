import * as HttpLayerRouter from "@effect/platform/HttpLayerRouter"
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Env } from "../env"

export const CorsLive = Layer.unwrapEffect(
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
          "Range",
        ],
        exposedHeaders: ["Accept-Ranges", "Content-Length", "Content-Range"],
        credentials: true,
      })
    )
  )
)

export const HttpServerLive = Layer.unwrapEffect(
  Env.pipe(Effect.map((env) => BunHttpServer.layer({ port: env.server.port })))
)
