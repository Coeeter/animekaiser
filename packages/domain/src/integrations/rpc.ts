import { Rpc, RpcGroup } from "@effect/rpc"
import * as Schema from "effect/Schema"
import { Authentication } from "../auth/rpc"
import {
  ExternalListAccountStatus,
  ExternalListOperationError,
  ExternalListProvider,
} from "./models"

export class ListExternalListAccounts extends Rpc.make(
  "ListExternalListAccounts",
  {
    success: Schema.Array(ExternalListAccountStatus),
    error: ExternalListOperationError,
  }
) {}

export class CreateExternalListLink extends Rpc.make("CreateExternalListLink", {
  payload: { provider: ExternalListProvider, callbackURL: Schema.String },
  success: Schema.Struct({ url: Schema.String }),
  error: ExternalListOperationError,
}) {}

export class DisconnectExternalListAccount extends Rpc.make(
  "DisconnectExternalListAccount",
  {
    payload: { provider: ExternalListProvider },
    success: Schema.Void,
    error: ExternalListOperationError,
  }
) {}

export class IntegrationRpcs extends RpcGroup.make(
  ListExternalListAccounts,
  CreateExternalListLink,
  DisconnectExternalListAccount
).middleware(Authentication) {}
