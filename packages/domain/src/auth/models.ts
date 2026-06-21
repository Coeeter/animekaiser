import * as Schema from "effect/Schema"

export class AuthenticationRequiredError extends Schema.TaggedError<AuthenticationRequiredError>()(
  "AuthenticationRequiredError",
  { message: Schema.String }
) {}
