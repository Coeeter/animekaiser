import {
  ExternalListOAuthStateStore,
  ExternalListOAuthStateStoreError,
} from "@workspace/core/server"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { RedisClient } from "../redis"

const key = (id: string) => `oauth-state:${id}`

export const ExternalListOAuthStateStoreLive = Layer.scoped(
  ExternalListOAuthStateStore,
  Effect.gen(function* () {
    const redis = yield* RedisClient

    return {
      create: (state) =>
        Effect.tryPromise({
          try: async () => {
            const id = crypto.randomUUID()
            await redis.set(key(id), JSON.stringify(state), "EX", 600)
            return id
          },
          catch: (cause) => new ExternalListOAuthStateStoreError({ cause }),
        }),
      take: (id) =>
        Effect.tryPromise({
          try: async () => {
            const value = await redis.getdel(key(id))
            return value ? JSON.parse(value) : undefined
          },
          catch: (cause) => new ExternalListOAuthStateStoreError({ cause }),
        }),
    }
  })
)
