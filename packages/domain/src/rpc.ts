import { Rpc, RpcClient, RpcGroup } from "@effect/rpc"
import * as Schema from "effect/Schema"
import { AuthenticationRequiredError } from "./auth"
import {
  ExternalListAccountStatus,
  ExternalListOperationError,
  ExternalListProvider,
  LibraryImportJob,
} from "./external-list"
import {
  OwnProfile,
  ProfileImageContentType,
  ProfileImageKind,
  ProfileImageUpload,
  ProfileOperationError,
  PublicProfile,
} from "./profile"

const authenticatedFailure = Schema.Union(
  AuthenticationRequiredError,
  ProfileOperationError
)

const externalListFailure = Schema.Union(
  AuthenticationRequiredError,
  ExternalListOperationError
)

export class KaiserRpcs extends RpcGroup.make(
  Rpc.make("Ping", { success: Schema.Literal("pong") }),
  Rpc.make("GetOwnProfile", {
    success: OwnProfile,
    error: authenticatedFailure,
  }),
  Rpc.make("GetPublicProfile", {
    payload: { username: Schema.String },
    success: PublicProfile,
    error: ProfileOperationError,
  }),
  Rpc.make("UpdateProfile", {
    payload: { description: Schema.NullOr(Schema.String) },
    success: OwnProfile,
    error: authenticatedFailure,
  }),
  Rpc.make("UpdatePrivacy", {
    payload: { private: Schema.Boolean },
    success: OwnProfile,
    error: authenticatedFailure,
  }),
  Rpc.make("CreateProfileImageUpload", {
    payload: {
      kind: ProfileImageKind,
      contentType: ProfileImageContentType,
      size: Schema.Number,
    },
    success: ProfileImageUpload,
    error: authenticatedFailure,
  }),
  Rpc.make("CompleteProfileImageUpload", {
    payload: { kind: ProfileImageKind, key: Schema.String },
    success: OwnProfile,
    error: authenticatedFailure,
  }),
  Rpc.make("RemoveProfileImage", {
    payload: { kind: ProfileImageKind },
    success: OwnProfile,
    error: authenticatedFailure,
  }),
  Rpc.make("DeleteAccount", {
    payload: { password: Schema.String },
    success: Schema.Void,
    error: authenticatedFailure,
  }),
  Rpc.make("ListExternalListAccounts", {
    success: Schema.Array(ExternalListAccountStatus),
    error: externalListFailure,
  }),
  Rpc.make("DisconnectExternalListAccount", {
    payload: { provider: ExternalListProvider },
    success: Schema.Void,
    error: externalListFailure,
  }),
  Rpc.make("StartLibraryImport", {
    payload: { provider: ExternalListProvider },
    success: LibraryImportJob,
    error: externalListFailure,
  })
) {}

export const KaiserRpcClient = RpcClient.make(KaiserRpcs)
