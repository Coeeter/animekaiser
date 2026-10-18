import * as Context from "effect/Context"
import { Rpc, RpcGroup } from "effect/rpc"
import * as RpcMiddleware from "effect/rpc/RpcMiddleware"
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

export class CurrentUser extends Context.Service<
  CurrentUser,
  AuthenticatedUser
>()("@animekaiser/domain/CurrentUser") {}

export class OptionalCurrentUser extends Context.Service<
  OptionalCurrentUser,
  AuthenticatedUser | null
>()("@animekaiser/domain/OptionalCurrentUser") {}

export class Authentication extends RpcMiddleware.Service<
  Authentication,
  { provides: CurrentUser }
>()("@animekaiser/domain/Authentication", {
  error: AuthenticationRequiredError,
}) {}

export class OptionalAuthentication extends RpcMiddleware.Service<
  OptionalAuthentication,
  { provides: OptionalCurrentUser }
>()("@animekaiser/domain/OptionalAuthentication") {}

export class GetCurrentSession extends Rpc.make("GetCurrentSession", {
  success: Schema.NullOr(AppSession),
  error: SessionOperationError,
}) {}

export class AuthRpcs extends RpcGroup.make(GetCurrentSession) {}
