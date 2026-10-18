import * as Effect from "effect/Effect"
import * as HttpEffect from "effect/http/HttpEffect"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import { BetterAuth } from "../auth"

export const AuthRoutesLive = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const auth = yield* BetterAuth
    const authApp = HttpEffect.fromWebHandler(auth.handler).pipe(
      Effect.catch(() =>
        Effect.succeed(
          HttpServerResponse.text("Auth handler failed", { status: 500 })
        )
      )
    )

    yield* router.add("*", "/api/auth/*", authApp)
  })
)
