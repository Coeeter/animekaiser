import { RecommendationService, RoomService } from "@animekaiser/core"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"

const logFailure = (task: string) => (error: unknown) =>
  Effect.logError(`[Rooms] ${task} failed.`, { error })

export const RoomLifecycleWorkerLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const rooms = yield* RoomService
    const ai = yield* RecommendationService
    yield* ai
      .recoverAfterRestart()
      .pipe(Effect.catchAll(logFailure("AI restart recovery")))
    yield* rooms
      .recoverAfterRestart()
      .pipe(Effect.catchAll(logFailure("Restart recovery")))
    yield* rooms
      .refreshLeases()
      .pipe(
        Effect.catchAll(logFailure("Lease refresh")),
        Effect.repeat(Schedule.spaced("30 seconds")),
        Effect.forkScoped
      )
    yield* rooms
      .sweep()
      .pipe(
        Effect.catchAll(logFailure("Sweep")),
        Effect.repeat(Schedule.spaced("10 seconds")),
        Effect.forkScoped
      )
  })
)
