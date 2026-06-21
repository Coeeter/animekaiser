import { AnimeCache, AnimeCacheError } from "@workspace/core/server"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import Redis from "ioredis"
import { Env } from "./env"

export const AnimeCacheLive = Layer.scoped(
  AnimeCache,
  Effect.gen(function* () {
    const env = yield* Env
    const redis = yield* Effect.acquireRelease(
      Effect.sync(() => new Redis(env.redis.url, { lazyConnect: true, maxRetriesPerRequest: 1 })),
      (client) => Effect.promise(() => client.quit()).pipe(Effect.asVoid)
    )
    yield* Effect.tryPromise({
      try: () => redis.connect(),
      catch: (cause) => new AnimeCacheError({ message: "Redis connection failed.", cause }),
    })

    return AnimeCache.of({
      get: (key, schema) =>
        Effect.tryPromise({
          try: () => redis.get(key),
          catch: (cause) => new AnimeCacheError({ message: "Redis read failed.", cause }),
        }).pipe(
          Effect.flatMap((value) => {
            if (value === null) return Effect.succeed(Option.none())
            return Effect.try({
              try: () => JSON.parse(value),
              catch: (cause) =>
                new AnimeCacheError({ message: "Cached JSON is invalid.", cause }),
            }).pipe(
              Effect.flatMap(Schema.decodeUnknown(schema)),
              Effect.map(Option.some),
              Effect.mapError(
                (cause) => new AnimeCacheError({ message: "Cached value is invalid.", cause })
              )
            )
          })
        ),
      set: (key, schema, value, ttlSeconds) =>
        Schema.encode(schema)(value).pipe(
          Effect.flatMap((encoded) =>
            Effect.tryPromise({
              try: () => redis.set(key, JSON.stringify(encoded), "EX", ttlSeconds),
              catch: (cause) =>
                new AnimeCacheError({ message: "Redis write failed.", cause }),
            })
          ),
          Effect.asVoid,
          Effect.mapError(
            (cause) =>
              cause instanceof AnimeCacheError
                ? cause
                : new AnimeCacheError({ message: "Cache encoding failed.", cause })
          )
        ),
    })
  })
)

