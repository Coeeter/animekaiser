import { Rpc, RpcGroup } from "@effect/rpc"
import * as Schema from "effect/Schema"
import { Authentication } from "../auth/rpc"
import {
  FriendRelation,
  FriendsOverview,
  SocialOperationError,
  SocialUserWithRelation,
} from "./models"

const UserId = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100))

export class SearchUsers extends Rpc.make("SearchUsers", {
  payload: { query: Schema.String.pipe(Schema.maxLength(100)) },
  success: Schema.Array(SocialUserWithRelation),
  error: SocialOperationError,
}) {}

export class ListFriends extends Rpc.make("ListFriends", {
  success: FriendsOverview,
  error: SocialOperationError,
}) {}

export class GetFriendRelation extends Rpc.make("GetFriendRelation", {
  payload: { username: Schema.String.pipe(Schema.maxLength(100)) },
  success: Schema.NullOr(
    Schema.Struct({ userId: Schema.String, relation: FriendRelation })
  ),
  error: SocialOperationError,
}) {}

export class SendFriendRequest extends Rpc.make("SendFriendRequest", {
  payload: { userId: UserId },
  success: FriendRelation,
  error: SocialOperationError,
}) {}

export class RespondFriendRequest extends Rpc.make("RespondFriendRequest", {
  payload: { userId: UserId, accept: Schema.Boolean },
  success: FriendRelation,
  error: SocialOperationError,
}) {}

export class RemoveFriendship extends Rpc.make("RemoveFriendship", {
  payload: { userId: UserId },
  success: FriendRelation,
  error: SocialOperationError,
}) {}

export class SocialRpcs extends RpcGroup.make(
  SearchUsers,
  ListFriends,
  GetFriendRelation,
  SendFriendRequest,
  RespondFriendRequest,
  RemoveFriendship
).middleware(Authentication) {}
