import {
  LIBRARY_SYNC_EVENT_CHANNEL,
  LibrarySyncService,
} from "@animekaiser/core"
import { Database } from "@animekaiser/db"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"

export const LibrarySyncWorkerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const database = yield* Database
    const sync = yield* LibrarySyncService
    const drain = sync
      .processNextEvent()
      .pipe(Effect.repeat({ while: (worked) => worked }), Effect.asVoid)

    yield* Effect.scoped(
      Effect.gen(function* () {
        const notifications = yield* database.listen(LIBRARY_SYNC_EVENT_CHANNEL)
        yield* sync.recoverRunningEvents()
        yield* drain
        return yield* Stream.fromQueue(notifications).pipe(
          Stream.runForEach(() => drain)
        )
      })
    ).pipe(
      Effect.tapError((error) =>
        Effect.logError("Library sync worker reconnecting.", { error })
      ),
      Effect.retry(Schedule.spaced("1 second")),
      Effect.forkScoped
    )
  })
).pipe(Layer.provide(LibrarySyncService.layer))
