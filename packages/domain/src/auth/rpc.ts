import { Rpc, RpcGroup } from "@effect/rpc"
import * as RpcMiddleware from "@effect/rpc/RpcMiddleware"
import * as Context from "effect/Context"
import * as Schema from "effect/Schema"
import {
  AppSession,
  AuthenticationRequiredError,
  SessionOperationError,
} from "./models"

export type AuthenticatedUser = {
  readonly id: string
  readonly image: string | null
}

export class CurrentUser extends Context.Tag("@animekaiser/domain/CurrentUser")<
  CurrentUser,
  AuthenticatedUser
>() {}

export class OptionalCurrentUser extends Context.Tag(
  "@animekaiser/domain/OptionalCurrentUser"
)<OptionalCurrentUser, AuthenticatedUser | null>() {}

export class Authentication extends RpcMiddleware.Tag<Authentication>()(
  "@animekaiser/domain/Authentication",
  { provides: CurrentUser, failure: AuthenticationRequiredError }
) {}

export class OptionalAuthentication extends RpcMiddleware.Tag<OptionalAuthentication>()(
  "@animekaiser/domain/OptionalAuthentication",
  { provides: OptionalCurrentUser }
) {}

export class GetCurrentSession extends Rpc.make("GetCurrentSession", {
  success: Schema.NullOr(AppSession),
  error: SessionOperationError,
}) {}

export class AuthRpcs extends RpcGroup.make(GetCurrentSession) {}
