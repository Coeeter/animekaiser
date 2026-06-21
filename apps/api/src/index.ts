import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import { ApiLive } from "./app"

Layer.launch(ApiLive).pipe(
  Effect.tapErrorCause(Effect.logError),
  Effect.retry({
    while: (error) => error._tag === "DatabaseConnectionError",
    schedule: Schedule.exponential("1 second", 2).pipe(
      Schedule.modifyDelay(Duration.min("8 seconds")),
      Schedule.jittered,
      Schedule.repetitions,
      Schedule.modifyDelayEffect((count, delay) =>
        Effect.as(
          Effect.logError(
            `[Server Crashed]: Retrying in ${Duration.format(delay)} (attempt #${count + 1})`
          ),
          delay
        )
      )
    ),
  }),
  BunRuntime.runMain()
)
