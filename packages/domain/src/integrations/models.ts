import * as Schema from "effect/Schema"

export const ExternalListProvider = Schema.Literals(["mal", "anilist"])
export type ExternalListProvider = typeof ExternalListProvider.Type

export const ExternalListAccountStatus = Schema.Struct({
  provider: ExternalListProvider,
  connected: Schema.Boolean,
  providerUsername: Schema.NullOr(Schema.String),
  profileImageUrl: Schema.NullOr(Schema.String),
  profileUrl: Schema.NullOr(Schema.String),
  expiresAt: Schema.NullOr(Schema.DateFromString),
  state: Schema.Literals([
    "disconnected",
    "active",
    "expiring",
    "expired",
    "relink_required",
  ]),
})
export type ExternalListAccountStatus = typeof ExternalListAccountStatus.Type

export const LibraryImportJob = Schema.Struct({
  id: Schema.String,
  provider: ExternalListProvider,
  status: Schema.Literals(["pending", "running", "completed", "failed"]),
  result: Schema.NullOr(
    Schema.Struct({
      insertedCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
      updatedCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
      unchangedCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
      skippedCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    })
  ),
  errorMessage: Schema.NullOr(Schema.String),
})
export type LibraryImportJob = typeof LibraryImportJob.Type

export class ExternalListOperationError extends Schema.TaggedError<ExternalListOperationError>()(
  "ExternalListOperationError",
  { message: Schema.String }
) {}
