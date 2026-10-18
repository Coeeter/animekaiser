import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import { ApiLive } from "./app"
import { reportFatalCause } from "./infra/alerts"

Layer.launch(ApiLive).pipe(
  Effect.tapCause(Effect.logError),
  Effect.retry({
    while: (error) => error._tag === "DatabaseConnectionError",
    schedule: Schedule.exponential("1 second", 2).pipe(
      Schedule.modifyDelay(({ duration }) =>
        Effect.succeed(Duration.min(duration, Duration.seconds(8)))
      ),
      Schedule.jittered,
      Schedule.modifyDelay(({ attempt, duration }) =>
        Effect.logError(
          `[Server Crashed]: Retrying in ${Duration.format(duration)} (attempt #${attempt})`
        ).pipe(Effect.as(duration))
      )
    ),
  }),
  Effect.tapCause(reportFatalCause),
  BunRuntime.runMain()
)
