import * as Schema from "effect/Schema"

export const ProfileUser = Schema.Struct({
  username: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
})
export type ProfileUser = typeof ProfileUser.Type

export const ProfileDetails = Schema.Struct({
  bannerUrl: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  private: Schema.Boolean,
  shareStats: Schema.Boolean,
  shareActivity: Schema.Boolean,
  shareList: Schema.Boolean,
})
export type ProfileDetails = typeof ProfileDetails.Type

export const ProfileImageKind = Schema.Literal("avatar", "banner")
export type ProfileImageKind = typeof ProfileImageKind.Type

export const ProfileImageContentType = Schema.Literal(
  "image/jpeg",
  "image/png",
  "image/webp"
)
export type ProfileImageContentType = typeof ProfileImageContentType.Type

export const ProfileImageUpload = Schema.Struct({
  key: Schema.String,
  uploadUrl: Schema.String,
})
export type ProfileImageUpload = typeof ProfileImageUpload.Type

export const OwnProfile = Schema.Struct({
  user: ProfileUser,
  profile: ProfileDetails,
})
export type OwnProfile = typeof OwnProfile.Type

export const PublicProfile = Schema.Union(
  Schema.Struct({ type: Schema.Literal("not_found") }),
  Schema.Struct({
    type: Schema.Literal("private"),
    user: ProfileUser,
  }),
  Schema.Struct({
    type: Schema.Literal("public"),
    user: ProfileUser,
    profile: ProfileDetails,
  })
)
export type PublicProfile = typeof PublicProfile.Type

export class ProfileOperationError extends Schema.TaggedError<ProfileOperationError>()(
  "ProfileOperationError",
  { message: Schema.String }
) {}
