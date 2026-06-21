import * as Schema from "effect/Schema"

export const ExternalListProvider = Schema.Literal("mal", "anilist")
export type ExternalListProvider = typeof ExternalListProvider.Type

export const ExternalListAccountStatus = Schema.Struct({
  provider: ExternalListProvider,
  connected: Schema.Boolean,
  expiresAt: Schema.NullOr(Schema.DateFromString),
})
export type ExternalListAccountStatus = typeof ExternalListAccountStatus.Type

export const LibraryImportJob = Schema.Struct({
  id: Schema.String,
  provider: ExternalListProvider,
  status: Schema.Literal("pending", "running", "completed", "failed"),
})
export type LibraryImportJob = typeof LibraryImportJob.Type

export class ExternalListOperationError extends Schema.TaggedError<ExternalListOperationError>()(
  "ExternalListOperationError",
  { message: Schema.String }
) {}
