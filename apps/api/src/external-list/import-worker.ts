import {
  LIBRARY_IMPORT_JOB_CHANNEL,
  LibraryImportService,
} from "@workspace/core/server"
import { Database } from "@workspace/db"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"
import * as Schedule from "effect/Schedule"

export const drainLibraryImportJobs = <TError, TRequirements>(
  processNextJob: Effect.Effect<boolean, TError, TRequirements>
) =>
  processNextJob.pipe(
    Effect.repeat({ while: (worked) => worked }),
    Effect.asVoid
  )

const importLoop = Effect.gen(function* () {
  const database = yield* Database
  const drain = drainLibraryImportJobs(LibraryImportService.processNextJob())

  return yield* Effect.scoped(
    Effect.gen(function* () {
      const events = yield* database.listen(LIBRARY_IMPORT_JOB_CHANNEL)
      yield* LibraryImportService.recoverRunningJobs()
      yield* Effect.logInfo("[Library Import] Worker listening.")
      yield* drain

      return yield* Queue.take(events).pipe(
        Effect.flatMap((event) =>
          event._tag === "Error" ? Effect.fail(event.error) : drain
        ),
        Effect.forever
      )
    })
  ).pipe(
    Effect.tapError((error) =>
      Effect.logError("[Library Import] Worker failed; reconnecting.", {
        error,
      })
    ),
    Effect.retry(Schedule.spaced("1 second"))
  )
})

export const LibraryImportWorkerLive = Layer.scopedDiscard(
  Effect.forkScoped(importLoop)
).pipe(Layer.provide(LibraryImportService.Default))
