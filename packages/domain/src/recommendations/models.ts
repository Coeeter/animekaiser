import * as Schema from "effect/Schema"
import { AnimeFormat, AnimeReleaseStatus, MalId } from "../anime/models"
import { AnimeLibraryMetadata } from "../library/models"

export const AiModelId = "openai/gpt-6-luna"

export const RecommendationCard = Schema.Struct({
  anime: AnimeLibraryMetadata,
  format: Schema.NullOr(AnimeFormat),
  status: Schema.NullOr(AnimeReleaseStatus),
  synopsis: Schema.NullOr(Schema.String),
  // Sequels can spoil earlier entries, so their synopsis stays collapsed.
  sequel: Schema.Boolean,
  reason: Schema.String,
  notes: Schema.Array(Schema.String),
})
export type RecommendationCard = typeof RecommendationCard.Type

export const RecapRange = Schema.Struct({
  malId: MalId,
  title: Schema.String,
  fromEpisode: Schema.Int.pipe(Schema.positive()),
  toEpisode: Schema.Int.pipe(Schema.positive()),
})
export type RecapRange = typeof RecapRange.Type

export const RecapMode = Schema.Literal("quick", "episodes")
export type RecapMode = typeof RecapMode.Type

export const RecapRequest = Schema.Struct({
  entries: Schema.Array(RecapRange).pipe(
    Schema.minItems(1),
    Schema.maxItems(6)
  ),
  mode: RecapMode,
  excludes: Schema.String.pipe(Schema.maxLength(200)),
})
export type RecapRequest = typeof RecapRequest.Type

export const RecapSource = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  domain: Schema.String,
  label: Schema.String,
  title: Schema.NullOr(Schema.String),
})
export type RecapSource = typeof RecapSource.Type

export const RecapSection = Schema.Struct({
  label: Schema.String,
  malId: MalId,
  fromEpisode: Schema.Int,
  toEpisode: Schema.Int,
  summary: Schema.String,
  interpretation: Schema.NullOr(Schema.String),
  sourceIds: Schema.Array(Schema.String),
})
export type RecapSection = typeof RecapSection.Type

export const RecapResult = Schema.Struct({
  request: RecapRequest,
  contains: Schema.String,
  excludes: Schema.String,
  sections: Schema.Array(RecapSection),
  gaps: Schema.Array(
    Schema.Struct({ label: Schema.String, reason: Schema.String })
  ),
  sources: Schema.Array(RecapSource),
  limitation: Schema.NullOr(Schema.String),
  retrievedAt: Schema.Number,
})
export type RecapResult = typeof RecapResult.Type

export const RecommendationMessageStatus = Schema.Literal(
  "complete",
  "pending",
  "failed",
  "stopped",
  "interrupted"
)

export const RecommendationMessage = Schema.Struct({
  id: Schema.String,
  seq: Schema.Int,
  role: Schema.Literal("user", "assistant"),
  status: RecommendationMessageStatus,
  content: Schema.String,
  cards: Schema.Array(RecommendationCard),
  recap: Schema.NullOr(RecapResult),
  recapRequest: Schema.NullOr(RecapRequest),
  activity: Schema.NullOr(Schema.String),
  createdAt: Schema.Number,
})
export type RecommendationMessage = typeof RecommendationMessage.Type

export const RecommendationThreadSummary = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  scope: Schema.Literal("personal", "guest"),
  updatedAt: Schema.Number,
})
export type RecommendationThreadSummary =
  typeof RecommendationThreadSummary.Type

export const RecommendationThread = Schema.Struct({
  ...RecommendationThreadSummary.fields,
  seed: Schema.NullOr(AnimeLibraryMetadata),
  messages: Schema.Array(RecommendationMessage),
  busy: Schema.Boolean,
})
export type RecommendationThread = typeof RecommendationThread.Type

export const AiAvailability = Schema.Struct({
  available: Schema.Boolean,
  reason: Schema.Literal("ok", "not_configured", "budget", "daily_limit"),
  remainingToday: Schema.NonNegativeInt,
  resetsAt: Schema.NullOr(Schema.Number),
})
export type AiAvailability = typeof AiAvailability.Type

export const RecommendationErrorReason = Schema.Literal(
  "not_configured",
  "daily_limit",
  "room_limit",
  "budget",
  "busy",
  "not_found",
  "forbidden",
  "invalid",
  "failed"
)

export class RecommendationOperationError extends Schema.TaggedError<RecommendationOperationError>()(
  "RecommendationOperationError",
  {
    reason: RecommendationErrorReason,
    message: Schema.String,
    resetsAt: Schema.optional(Schema.Number),
  }
) {}
