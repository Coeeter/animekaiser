import { AuthServer } from "@workspace/auth/server"
import type { KaiserAuth } from "@workspace/auth/server"
import {
  Authentication,
  AuthenticationRequiredError,
  OptionalAuthentication,
} from "@workspace/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

const readSession = (
  auth: KaiserAuth,
  headers: Readonly<Record<string, string>>
) =>
  Effect.tryPromise({
    try: () =>
      auth.api.getSession({ headers: new globalThis.Headers(headers) }),
    catch: () =>
      new AuthenticationRequiredError({
        message: "Authentication request could not be read.",
      }),
  })

export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const auth = yield* AuthServer
    return Authentication.of(({ headers }) =>
      readSession(auth, headers).pipe(
        Effect.flatMap((session) =>
          session
            ? Effect.succeed({
                id: session.user.id,
                image: session.user.image ?? null,
              })
            : Effect.fail(
                new AuthenticationRequiredError({
                  message: "Authentication is required.",
                })
              )
        )
      )
    )
  })
)

export const OptionalAuthenticationLive = Layer.effect(
  OptionalAuthentication,
  Effect.gen(function* () {
    const auth = yield* AuthServer
    return OptionalAuthentication.of(({ headers }) =>
      readSession(auth, headers).pipe(
        Effect.map((session) =>
          session
            ? { id: session.user.id, image: session.user.image ?? null }
            : null
        ),
        Effect.catchTag("AuthenticationRequiredError", () =>
          Effect.succeed(null)
        )
      )
    )
  })
)

export const AuthenticationMiddlewareLive = Layer.mergeAll(
  AuthenticationLive,
  OptionalAuthenticationLive
)
