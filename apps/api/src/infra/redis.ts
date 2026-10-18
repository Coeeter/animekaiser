import { KeyValueStore, KeyValueStoreError } from "@animekaiser/core"
import * as BunRedis from "@effect/platform-bun/BunRedis"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redis from "effect/persistence/Redis"
import { Env } from "../env"

export class RedisConnectionError extends Data.TaggedError(
  "RedisConnectionError"
)<{ cause: unknown }> {}

// Without the offline queue, commands fail at once while Redis is down instead
// of waiting for a reconnect. Bun connects lazily, so the connection is opened
// explicitly at startup, where a failure stops the API.
const clientOptions = {
  enableOfflineQueue: false,
  connectionTimeout: 3_000,
}

const RedisKeyValueStore = Layer.effect(
  KeyValueStore,
  Effect.gen(function* () {
    const bunRedis = yield* BunRedis.BunRedis
    yield* bunRedis
      .use((client) => client.connect())
      .pipe(
        Effect.timeout("5 seconds"),
        Effect.mapError((cause) => new RedisConnectionError({ cause }))
      )
    const redis = yield* Redis.Redis
    const command = <A>(name: string, ...args: ReadonlyArray<string>) =>
      redis
        .send<A>(name, ...args)
        .pipe(Effect.mapError((cause) => new KeyValueStoreError({ cause })))
    return KeyValueStore.of({
      get: (key) => command<string | null>("GET", key),
      getDelete: (key) => command<string | null>("GETDEL", key),
      set: (key, value, ttlSeconds) =>
        Effect.asVoid(command("SET", key, value, "EX", String(ttlSeconds))),
    })
  })
)

export const RedisKeyValueStoreLive = Layer.unwrap(
  Effect.map(Env, (env) =>
    RedisKeyValueStore.pipe(
      Layer.provide(BunRedis.layer({ url: env.redis.url, ...clientOptions }))
    )
  )
)
