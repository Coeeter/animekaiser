import { HttpApp, HttpLayerRouter, HttpServerResponse } from "@effect/platform"
import * as Effect from "effect/Effect"
import { BetterAuth } from "."

export const AuthRoutesLive = HttpLayerRouter.use((router) =>
  Effect.gen(function* () {
    const auth = yield* BetterAuth
    const authApp = HttpApp.fromWebHandler(auth.handler).pipe(
      Effect.catchAll(() =>
        HttpServerResponse.text("Auth handler failed", { status: 500 })
      )
    )

    yield* router.add("*", "/api/auth/*", authApp)
  })
)
