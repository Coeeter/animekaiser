import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import Redis from "ioredis"
import { Env } from "./env"

export class RedisConnectionError extends Data.TaggedError(
  "RedisConnectionError"
)<{ cause: unknown }> {}

export class RedisClient extends Context.Tag("@workspace/api/RedisClient")<
  RedisClient,
  Redis
>() {}

export const RedisClientLive = Layer.scoped(
  RedisClient,
  Effect.gen(function* () {
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
  })
)
