import { KeyValueStore, KeyValueStoreError } from "@workspace/core"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import Redis from "ioredis"
import { Env } from "../env"

export class RedisConnectionError extends Data.TaggedError(
  "RedisConnectionError"
)<{ cause: unknown }> {}

export class RedisClient extends Effect.Service<RedisClient>()(
  "@workspace/api/RedisClient",
  {
    scoped: Effect.gen(function* () {
      const env = yield* Env
      const client = yield* Effect.acquireRelease(
        Effect.sync(
          () =>
            new Redis(env.redis.url, {
              lazyConnect: true,
              maxRetriesPerRequest: 1,
            })
        ),
        (redis) => Effect.promise(() => redis.quit()).pipe(Effect.orDie)
      )
      yield* Effect.tryPromise({
        try: () => client.connect(),
        catch: (cause) => new RedisConnectionError({ cause }),
      })
      return client
    }),
  }
) {}

export const RedisKeyValueStoreLive = Layer.effect(
  KeyValueStore,
  Effect.gen(function* () {
    const redis = yield* RedisClient
    return KeyValueStore.of({
      get: (key) =>
        Effect.tryPromise({
          try: () => redis.get(key),
          catch: (cause) => new KeyValueStoreError({ cause }),
        }),
      getDelete: (key) =>
        Effect.tryPromise({
          try: () => redis.getdel(key),
          catch: (cause) => new KeyValueStoreError({ cause }),
        }),
      set: (key, value, ttlSeconds) =>
        Effect.tryPromise({
          try: () => redis.set(key, value, "EX", ttlSeconds),
          catch: (cause) => new KeyValueStoreError({ cause }),
        }).pipe(Effect.asVoid),
    })
  })
).pipe(Layer.provide(RedisClient.Default))
