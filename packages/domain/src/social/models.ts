import * as Schema from "effect/Schema"

export const FriendRelation = Schema.Literals([
  "none",
  "self",
  "friends",
  "outgoing",
  "incoming",
])
export type FriendRelation = typeof FriendRelation.Type

export const SocialUser = Schema.Struct({
  id: Schema.String,
  username: Schema.NullOr(Schema.String),
  displayName: Schema.String,
  image: Schema.NullOr(Schema.String),
})
export type SocialUser = typeof SocialUser.Type

export const SocialUserWithRelation = Schema.Struct({
  ...SocialUser.fields,
  relation: FriendRelation,
})
export type SocialUserWithRelation = typeof SocialUserWithRelation.Type

export const FriendsOverview = Schema.Struct({
  friends: Schema.Array(SocialUser),
  incoming: Schema.Array(SocialUser),
  outgoing: Schema.Array(SocialUser),
})
export type FriendsOverview = typeof FriendsOverview.Type

export const SocialErrorReason = Schema.Literals([
  "not_found",
  "invalid",
  "rate_limited",
  "unavailable",
])

export class SocialOperationError extends Schema.TaggedError<SocialOperationError>()(
  "SocialOperationError",
  { reason: SocialErrorReason, message: Schema.String }
) {}
