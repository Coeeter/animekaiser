import { Rpc, RpcGroup } from "@effect/rpc"
import * as Schema from "effect/Schema"
import { Authentication, OptionalAuthentication } from "../auth/rpc"
import {
  OwnProfile,
  ProfileImageContentType,
  ProfileImageKind,
  ProfileImageUpload,
  ProfileOperationError,
  PublicProfile,
} from "./models"
import { ProfileStats, PublicProfileStats } from "./stats"

export class GetOwnProfile extends Rpc.make("GetOwnProfile", {
  success: OwnProfile,
  error: ProfileOperationError,
}) {}

export class GetPublicProfile extends Rpc.make("GetPublicProfile", {
  payload: {
    username: Schema.String,
    asPublic: Schema.optional(Schema.Boolean),
  },
  success: PublicProfile,
  error: ProfileOperationError,
}) {}

export class UpdateProfile extends Rpc.make("UpdateProfile", {
  payload: { description: Schema.NullOr(Schema.String) },
  success: OwnProfile,
  error: ProfileOperationError,
}) {}

export class UpdatePrivacy extends Rpc.make("UpdatePrivacy", {
  payload: {
    private: Schema.optional(Schema.Boolean),
    shareStats: Schema.optional(Schema.Boolean),
    shareActivity: Schema.optional(Schema.Boolean),
    shareList: Schema.optional(Schema.Boolean),
  },
  success: OwnProfile,
  error: ProfileOperationError,
}) {}

export class CreateProfileImageUpload extends Rpc.make(
  "CreateProfileImageUpload",
  {
    payload: {
      kind: ProfileImageKind,
      contentType: ProfileImageContentType,
      size: Schema.Number,
    },
    success: ProfileImageUpload,
    error: ProfileOperationError,
  }
) {}

export class CompleteProfileImageUpload extends Rpc.make(
  "CompleteProfileImageUpload",
  {
    payload: { kind: ProfileImageKind, key: Schema.String },
    success: OwnProfile,
    error: ProfileOperationError,
  }
) {}

export class RemoveProfileImage extends Rpc.make("RemoveProfileImage", {
  payload: { kind: ProfileImageKind },
  success: OwnProfile,
  error: ProfileOperationError,
}) {}

export class GetOwnProfileStats extends Rpc.make("GetOwnProfileStats", {
  success: ProfileStats,
  error: ProfileOperationError,
}) {}

export class GetPublicProfileStats extends Rpc.make("GetPublicProfileStats", {
  payload: {
    username: Schema.String,
    asPublic: Schema.optional(Schema.Boolean),
  },
  success: Schema.NullOr(PublicProfileStats),
  error: ProfileOperationError,
}) {}

export class DeleteAccount extends Rpc.make("DeleteAccount", {
  payload: { password: Schema.String },
  success: Schema.Void,
  error: ProfileOperationError,
}) {}

class PublicProfileRpcs extends RpcGroup.make(
  GetPublicProfile,
  GetPublicProfileStats
).middleware(OptionalAuthentication) {}

class AuthenticatedProfileRpcs extends RpcGroup.make(
  GetOwnProfile,
  UpdateProfile,
  UpdatePrivacy,
  GetOwnProfileStats,
  CreateProfileImageUpload,
  CompleteProfileImageUpload,
  RemoveProfileImage,
  DeleteAccount
).middleware(Authentication) {}

export class ProfileRpcs extends RpcGroup.make().merge(
  PublicProfileRpcs,
  AuthenticatedProfileRpcs
) {}
