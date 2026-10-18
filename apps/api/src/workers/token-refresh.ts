import { ExternalListAccountsService } from "@animekaiser/core"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"

export const ExternalListTokenRefreshWorkerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const accounts = yield* ExternalListAccountsService
    yield* Effect.logInfo("[External List Token Refresh] Worker started.")
    yield* accounts.refreshDueTokens().pipe(
      Effect.catch((error) =>
        Effect.logError("[External List Token Refresh] Worker tick failed.", {
          error,
        })
      ),
      Effect.repeat(Schedule.spaced("5 minutes")),
      Effect.forkScoped
    )
  })
).pipe(Layer.provide(ExternalListAccountsService.layer))
