import { Rpc, RpcGroup } from "@effect/rpc"
import * as Schema from "effect/Schema"
import { AuthenticationRequiredError } from "../auth"
import {
  ExternalListAccountStatus,
  ExternalListOperationError,
  ExternalListProvider,
} from "../external-list"

const failure = Schema.Union(AuthenticationRequiredError, ExternalListOperationError)

export const IntegrationRpcs = RpcGroup.make(
  Rpc.make("ListExternalListAccounts", {
    success: Schema.Array(ExternalListAccountStatus),
    error: failure,
  }),
  Rpc.make("CreateExternalListLink", {
    payload: { provider: ExternalListProvider, callbackURL: Schema.String },
    success: Schema.Struct({ url: Schema.String }),
    error: failure,
  }),
  Rpc.make("DisconnectExternalListAccount", {
    payload: { provider: ExternalListProvider },
    success: Schema.Void,
    error: failure,
  })
)

