import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { authClient } from "./api-clients"

export class AuthError extends Schema.TaggedError<AuthError>()("AuthError", {
  message: Schema.String,
  code: Schema.optional(Schema.String),
  status: Schema.optional(Schema.Number),
}) {}

type AuthResult<A> =
  | { data: A; error: null }
  | {
      data: null
      error: { message?: string; code?: string; status: number }
    }

// Better Auth resolves with `{ data, error }` instead of rejecting, so both the
// request and the reported error land in the error channel as `AuthError`.
export const auth = <A>(
  request: (client: typeof authClient) => Promise<AuthResult<A>>
) =>
  Effect.tryPromise({
    try: () => request(authClient),
    catch: () =>
      new AuthError({ message: "Couldn't reach the server. Try again." }),
  }).pipe(
    Effect.flatMap((result) =>
      result.error
        ? Effect.fail(
            new AuthError({
              message: result.error.message ?? "Something went wrong.",
              code: result.error.code,
              status: result.error.status,
            })
          )
        : Effect.succeed(result.data as A)
    )
  )
