import type { KaiserAuth } from "@animekaiser/auth/server"
import { AuthServer } from "@animekaiser/auth/server"
import {
  Authentication,
  AuthenticationRequiredError,
  AuthRpcs,
  CurrentUser,
  OptionalAuthentication,
  OptionalCurrentUser,
  SessionOperationError,
} from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import type * as Headers from "effect/http/Headers"
import * as Layer from "effect/Layer"

const readSession = (auth: KaiserAuth, headers: Headers.Headers) =>
  Effect.tryPromise({
    try: () =>
      auth.api.getSession({ headers: new globalThis.Headers(headers) }),
    catch: () =>
      new AuthenticationRequiredError({
        message: "Authentication request could not be read.",
      }),
  })

export const AuthHandlersLive = AuthRpcs.toLayer(
  Effect.gen(function* () {
    const auth = yield* AuthServer
    return AuthRpcs.of({
      GetCurrentSession: (_, { headers }) =>
        Effect.tryPromise({
          try: () =>
            auth.api.getSession({
              headers: new globalThis.Headers(headers),
            }),
          catch: () =>
            new SessionOperationError({
              message: "Unable to read the current session.",
            }),
        }).pipe(
          Effect.map((session) =>
            session
              ? {
                  session: {
                    expiresAt: session.session.expiresAt,
                    token: session.session.token,
                  },
                  user: {
                    id: session.user.id,
                    name: session.user.name,
                    email: session.user.email,
                    image: session.user.image ?? null,
                    username: session.user.username ?? null,
                    displayUsername: session.user.displayUsername ?? null,
                  },
                }
              : null
          )
        ),
    })
  })
)

export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const auth = yield* AuthServer
    return Authentication.of((effect, { headers }) =>
      Effect.gen(function* () {
        const session = yield* readSession(auth, headers)
        if (!session) {
          return yield* new AuthenticationRequiredError({
            message: "Authentication is required.",
          })
        }
        return yield* Effect.provideService(effect, CurrentUser, {
          id: session.user.id,
          image: session.user.image ?? null,
        })
      })
    )
  })
)

export const OptionalAuthenticationLive = Layer.effect(
  OptionalAuthentication,
  Effect.gen(function* () {
    const auth = yield* AuthServer
    return OptionalAuthentication.of((effect, { headers }) =>
      readSession(auth, headers).pipe(
        Effect.map((session) =>
          session
            ? { id: session.user.id, image: session.user.image ?? null }
            : null
        ),
        Effect.orElseSucceed(() => null),
        Effect.flatMap((user) =>
          Effect.provideService(effect, OptionalCurrentUser, user)
        )
      )
    )
  })
)

export const AuthenticationMiddlewareLive = Layer.mergeAll(
  AuthenticationLive,
  OptionalAuthenticationLive
)
