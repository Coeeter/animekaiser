import * as RpcMiddleware from "@effect/rpc/RpcMiddleware"
import * as Context from "effect/Context"
import { AuthenticationRequiredError } from "./models"

export type AuthenticatedUser = {
  readonly id: string
  readonly image: string | null
}

export class CurrentUser extends Context.Tag("@workspace/domain/CurrentUser")<
  CurrentUser,
  AuthenticatedUser
>() {}

export class OptionalCurrentUser extends Context.Tag(
  "@workspace/domain/OptionalCurrentUser"
)<OptionalCurrentUser, AuthenticatedUser | null>() {}

export class Authentication extends RpcMiddleware.Tag<Authentication>()(
  "@workspace/domain/Authentication",
  { provides: CurrentUser, failure: AuthenticationRequiredError }
) {}

export class OptionalAuthentication extends RpcMiddleware.Tag<OptionalAuthentication>()(
  "@workspace/domain/OptionalAuthentication",
  { provides: OptionalCurrentUser }
) {}
