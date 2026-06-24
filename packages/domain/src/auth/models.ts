import * as Schema from "effect/Schema"

export class AuthenticationRequiredError extends Schema.TaggedError<AuthenticationRequiredError>()(
  "AuthenticationRequiredError",
  { message: Schema.String }
) {}

export const AppSession = Schema.Struct({
  session: Schema.Struct({
    expiresAt: Schema.DateFromString,
  }),
  user: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    email: Schema.String,
    image: Schema.NullOr(Schema.String),
    username: Schema.optional(Schema.NullOr(Schema.String)),
    displayUsername: Schema.optional(Schema.NullOr(Schema.String)),
  }),
})
export type AppSession = typeof AppSession.Type

export class SessionOperationError extends Schema.TaggedError<SessionOperationError>()(
  "SessionOperationError",
  { message: Schema.String }
) {}
