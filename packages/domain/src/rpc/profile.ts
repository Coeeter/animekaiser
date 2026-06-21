import { Rpc, RpcGroup } from "@effect/rpc"
import * as Schema from "effect/Schema"
import { AuthenticationRequiredError } from "../auth"
import {
  OwnProfile,
  ProfileImageContentType,
  ProfileImageKind,
  ProfileImageUpload,
  ProfileOperationError,
  PublicProfile,
} from "../profile"

const authenticatedFailure = Schema.Union(
  AuthenticationRequiredError,
  ProfileOperationError
)

export const ProfileRpcs = RpcGroup.make(
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
  })
)
