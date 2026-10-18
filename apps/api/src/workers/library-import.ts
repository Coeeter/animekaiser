import {
  LIBRARY_IMPORT_JOB_CHANNEL,
  LibraryImportService,
} from "@animekaiser/core"
import { Database } from "@animekaiser/db"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"

export const drainLibraryImportJobs = <TError, TRequirements>(
  processNextJob: Effect.Effect<boolean, TError, TRequirements>
) =>
  processNextJob.pipe(
    Effect.repeat({ while: (worked) => worked }),
    Effect.asVoid
  )

export const LibraryImportWorkerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const database = yield* Database
    const imports = yield* LibraryImportService
    const drain = drainLibraryImportJobs(imports.processNextJob())

    yield* Effect.scoped(
      Effect.gen(function* () {
        // LISTEN before draining so a job queued in between still wakes us.
        const notifications = yield* database.listen(LIBRARY_IMPORT_JOB_CHANNEL)
        yield* imports.recoverRunningJobs()
        yield* Effect.logInfo("[Library Import] Worker listening.")
        yield* drain
        return yield* Stream.fromQueue(notifications).pipe(
          Stream.runForEach(() => drain)
        )
      })
    ).pipe(
      Effect.tapError((error) =>
        Effect.logError("[Library Import] Worker failed; reconnecting.", {
          error,
        })
      ),
      Effect.retry(Schedule.spaced("1 second")),
      Effect.forkScoped
    )
  })
).pipe(Layer.provide(LibraryImportService.layer))
