import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as RateLimiter from "effect/persistence/RateLimiter"

export type ThrottleLimit = {
  readonly key: string
  readonly limit: number
  readonly window: Duration.Input
}

// Delays each call until every token bucket has capacity. The in-memory store
// cannot fail, so a store error is a defect.
export const makeThrottle = Effect.fnUntraced(function* (
  limits: ReadonlyArray<ThrottleLimit>
) {
  const limiter = yield* RateLimiter.make
  const acquire = Effect.forEach(
    limits,
    (limit) =>
      RateLimiter.sleep(limiter, { ...limit, algorithm: "token-bucket" }),
    { discard: true }
  ).pipe(Effect.orDie)
  return <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.andThen(acquire, effect)
})

export const throttleStoreLayer = RateLimiter.layerStoreMemory
