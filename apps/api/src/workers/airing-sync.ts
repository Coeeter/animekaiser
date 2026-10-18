import { AiringService } from "@animekaiser/core"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"

export const AiringSyncWorkerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const airing = yield* AiringService
    yield* Effect.logInfo("[Airing Sync] Worker started.")
    yield* airing.sync().pipe(
      Effect.catch((error) =>
        Effect.logError("[Airing Sync] Worker tick failed.", { error })
      ),
      Effect.repeat(Schedule.spaced("1 hour")),
      Effect.forkScoped
    )
    yield* airing.refreshLatestAvailability().pipe(
      Effect.tap((episodes) =>
        Effect.logInfo("[Airing Sync] Latest availability refreshed.", {
          episodes,
        })
      ),
      Effect.catch((error) =>
        Effect.logError("[Airing Sync] Latest availability refresh failed.", {
          error,
        })
      ),
      Effect.repeat(Schedule.spaced("10 minutes")),
      Effect.forkScoped
    )
  })
).pipe(Layer.provide(AiringService.layer))
