import * as Data from "effect/Data"

export class AuthenticationRequiredError extends Data.TaggedError(
  "AuthenticationRequiredError"
)<{ message: string }> {}
