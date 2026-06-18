import { ExternalListTokenRefreshProgram } from "@workspace/core/server"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

const refreshLoop = Effect.gen(function* () {
  yield* Effect.logInfo("[External List Token Refresh] Worker started.")
  return yield* ExternalListTokenRefreshProgram().pipe(
    Effect.catchAll((error) =>
      Effect.logError("[External List Token Refresh] Worker tick failed.", {
        error,
      })
    ),
    Effect.zipRight(Effect.sleep(Duration.minutes(5))),
    Effect.forever
  )
})

export const ExternalListTokenRefreshWorkerLive = Layer.scopedDiscard(
  Effect.forkScoped(refreshLoop)
)
