import { MalApiConfig } from "@animekaiser/core"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Env } from "../env"

export const MalApiConfigLive = Layer.effect(
  MalApiConfig,
  Effect.map(Env, (env) => ({ clientId: env.externalList.mal.clientId }))
)
