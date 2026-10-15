import { Rpc, RpcGroup } from "@effect/rpc"
import * as Schema from "effect/Schema"
import { MalId } from "../anime/models"
import { Authentication } from "../auth/rpc"
import { RoomId } from "../rooms/models"
import { RoomAuthentication } from "../rooms/rpc"
import {
  AiAvailability,
  RecapRequest,
  RecommendationOperationError,
  RecommendationThread,
  RecommendationThreadSummary,
} from "./models"

const ThreadId = Schema.UUID
const RequestId = Schema.String.pipe(Schema.minLength(8), Schema.maxLength(64))
const Content = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(2000))

export class ListRecommendationThreads extends Rpc.make(
  "ListRecommendationThreads",
  {
    success: Schema.Array(RecommendationThreadSummary),
    error: RecommendationOperationError,
  }
) {}

export class GetAiPreferences extends Rpc.make("GetAiPreferences", {
  success: Schema.Array(Schema.String),
  error: RecommendationOperationError,
}) {}

export class SaveAiPreferences extends Rpc.make("SaveAiPreferences", {
  payload: {
    notes: Schema.Array(Schema.String.pipe(Schema.maxLength(200))).pipe(
      Schema.maxItems(20)
    ),
  },
  success: Schema.Void,
  error: RecommendationOperationError,
}) {}

export class RenameRecommendationThread extends Rpc.make(
  "RenameRecommendationThread",
  {
    payload: {
      threadId: ThreadId,
      title: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(80)),
    },
    success: Schema.Void,
    error: RecommendationOperationError,
  }
) {}

export class DeleteRecommendationThread extends Rpc.make(
  "DeleteRecommendationThread",
  {
    payload: { threadId: ThreadId },
    success: Schema.Void,
    error: RecommendationOperationError,
  }
) {}

export class ShareRecommendationToRoom extends Rpc.make(
  "ShareRecommendationToRoom",
  {
    payload: {
      roomId: RoomId,
      threadId: ThreadId,
      messageId: Schema.String,
      malId: Schema.optional(MalId),
    },
    success: Schema.Void,
    error: RecommendationOperationError,
  }
) {}

class AccountRecommendationRpcs extends RpcGroup.make(
  ListRecommendationThreads,
  GetAiPreferences,
  SaveAiPreferences,
  RenameRecommendationThread,
  DeleteRecommendationThread,
  ShareRecommendationToRoom
).middleware(Authentication) {}

// Thread RPCs accept a room actor so a guest can own a private, room-scoped
// catch-up thread; ownership is always checked against the actor.
export class GetAiAvailability extends Rpc.make("GetAiAvailability", {
  payload: { roomId: Schema.optional(RoomId) },
  success: AiAvailability,
}) {}

export class CreateRecommendationThread extends Rpc.make(
  "CreateRecommendationThread",
  {
    payload: {
      threadId: ThreadId,
      seedMalId: Schema.optional(MalId),
      roomId: Schema.optional(RoomId),
    },
    success: RecommendationThread,
    error: RecommendationOperationError,
  }
) {}

export class GetRecommendationThread extends Rpc.make(
  "GetRecommendationThread",
  {
    payload: { threadId: ThreadId },
    success: RecommendationThread,
    error: RecommendationOperationError,
  }
) {}

export class SendRecommendationMessage extends Rpc.make(
  "SendRecommendationMessage",
  {
    payload: {
      threadId: ThreadId,
      requestId: RequestId,
      content: Content,
      recap: Schema.optional(RecapRequest),
    },
    success: RecommendationThread,
    error: RecommendationOperationError,
  }
) {}

export class StopRecommendation extends Rpc.make("StopRecommendation", {
  payload: { threadId: ThreadId },
  success: Schema.Void,
  error: RecommendationOperationError,
}) {}

export class AskRoomAi extends Rpc.make("AskRoomAi", {
  payload: { roomId: RoomId, requestId: RequestId, content: Content },
  success: Schema.Void,
  error: RecommendationOperationError,
}) {}

export class StopRoomAi extends Rpc.make("StopRoomAi", {
  payload: { roomId: RoomId },
  success: Schema.Void,
  error: RecommendationOperationError,
}) {}

class ActorRecommendationRpcs extends RpcGroup.make(
  GetAiAvailability,
  CreateRecommendationThread,
  GetRecommendationThread,
  SendRecommendationMessage,
  StopRecommendation,
  AskRoomAi,
  StopRoomAi
).middleware(RoomAuthentication) {}

export class RecommendationRpcs extends RpcGroup.make().merge(
  AccountRecommendationRpcs,
  ActorRecommendationRpcs
) {}
