import { RpcServerConfig } from "@animekaiser/rpc/server"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Env } from "../env"

export const RpcServerConfigLive = Layer.effect(
  RpcServerConfig,
  Env.pipe(
    Effect.map((env) => ({
      appUrl: env.app.url,
      mediaPublicUrl: env.r2.publicUrl,
    }))
  )
)
