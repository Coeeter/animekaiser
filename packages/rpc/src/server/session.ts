import { AuthServer } from "@workspace/auth/server"
import { AuthenticationRequiredError } from "@workspace/domain"
import * as Effect from "effect/Effect"

export class RpcSession extends Effect.Service<RpcSession>()("@workspace/rpc/RpcSession", {
  accessors: true,
  effect: Effect.gen(function* () {
    const auth = yield* AuthServer

    const fromHeaders = Effect.fn("RpcSession.fromHeaders")(function* (
      headers: Readonly<Record<string, string>>
    ) {
      return yield* Effect.tryPromise({
        try: () => auth.api.getSession({ headers: new globalThis.Headers(headers) }),
        catch: () =>
          new AuthenticationRequiredError({
            message: "Authentication request could not be read.",
          }),
      })
    })

    const requireSession = Effect.fn("RpcSession.requireSession")(function* (
      headers: Readonly<Record<string, string>>
    ) {
      const session = yield* fromHeaders(headers)
      return yield* session
        ? Effect.succeed(session)
        : new AuthenticationRequiredError({ message: "Authentication is required." })
    })

    const requireUser = (headers: Readonly<Record<string, string>>) =>
      requireSession(headers).pipe(Effect.map((session) => session.user))

    return { auth, fromHeaders, requireSession, requireUser }
  }),
}) {}

