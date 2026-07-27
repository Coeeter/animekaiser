import {
  LIBRARY_SYNC_EVENT_CHANNEL,
  LibrarySyncService,
} from "@animekaiser/core"
import { Database } from "@animekaiser/db"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"
import * as Schedule from "effect/Schedule"

const drain = LibrarySyncService.processNextEvent().pipe(
  Effect.repeat({ while: (worked) => worked }),
  Effect.asVoid
)

const syncLoop = Effect.scoped(
  Effect.gen(function* () {
    const database = yield* Database
    const events = yield* database.listen(LIBRARY_SYNC_EVENT_CHANNEL)
    yield* LibrarySyncService.recoverRunningEvents()
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
    Effect.logError("Library sync worker reconnecting.", { error })
  ),
  Effect.retry(Schedule.spaced("1 second"))
)

export const LibrarySyncWorkerLive = Layer.scopedDiscard(
  Effect.forkScoped(syncLoop)
).pipe(Layer.provide(LibrarySyncService.Default))
