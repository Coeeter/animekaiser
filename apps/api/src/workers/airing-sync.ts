import { AiringService } from "@animekaiser/core"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

const syncLoop = Effect.gen(function* () {
  yield* Effect.logInfo("[Airing Sync] Worker started.")
  return yield* AiringService.sync().pipe(
    Effect.catchAll((error) =>
      Effect.logError("[Airing Sync] Worker tick failed.", { error })
    ),
    Effect.zipRight(Effect.sleep(Duration.hours(1))),
    Effect.forever
  )
})

export const AiringSyncWorkerLive = Layer.scopedDiscard(
  Effect.forkScoped(syncLoop)
).pipe(Layer.provide(AiringService.Default))
