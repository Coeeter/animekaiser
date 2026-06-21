import * as Schema from "effect/Schema"
import { AniListId, AnimeTitle, MalId } from "./anime"
import { ExternalListProvider } from "./external-list"

export const LibraryStatus = Schema.Literal(
  "watching",
  "completed",
  "paused",
  "dropped",
  "planning",
  "rewatching"
)
export type LibraryStatus = typeof LibraryStatus.Type

export const LibrarySort = Schema.Literal(
  "updated_desc",
  "updated_asc",
  "title_asc",
  "score_desc",
  "progress_desc"
)
export type LibrarySort = typeof LibrarySort.Type

export const AnimeLibraryMetadata = Schema.Struct({
  malId: MalId,
  aniListId: Schema.NullOr(AniListId),
  title: AnimeTitle,
  coverImage: Schema.NullOr(Schema.String),
  episodes: Schema.NullOr(Schema.Int.pipe(Schema.positive())),
})
export type AnimeLibraryMetadata = typeof AnimeLibraryMetadata.Type

export const LibraryEntry = Schema.Struct({
  malId: MalId,
  status: LibraryStatus,
  score: Schema.NullOr(Schema.Int.pipe(Schema.between(0, 100))),
  progress: Schema.NonNegativeInt,
  notes: Schema.NullOr(Schema.String),
  aniListEntryId: Schema.NullOr(Schema.Int.pipe(Schema.positive())),
  anime: AnimeLibraryMetadata,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
})
export type LibraryEntry = typeof LibraryEntry.Type

export const LibraryStats = Schema.Struct({
  total: Schema.NonNegativeInt,
  byStatus: Schema.Record({ key: LibraryStatus, value: Schema.NonNegativeInt }),
  meanScore: Schema.NullOr(Schema.Int.pipe(Schema.between(0, 100))),
})
export type LibraryStats = typeof LibraryStats.Type

export const LibraryPage = Schema.Struct({
  items: Schema.Array(LibraryEntry),
  page: Schema.Int.pipe(Schema.positive()),
  perPage: Schema.Int.pipe(Schema.positive()),
  total: Schema.NonNegativeInt,
  totalPages: Schema.Int.pipe(Schema.positive()),
  stats: LibraryStats,
})
export type LibraryPage = typeof LibraryPage.Type

export const LibraryRemovalResult = Schema.Struct({
  removed: Schema.Boolean,
  queuedProviders: Schema.Array(ExternalListProvider),
})

export const LibrarySyncAction = Schema.Literal("upsert", "delete")
export const LibrarySyncStatus = Schema.Literal(
  "pending",
  "running",
  "completed",
  "failed",
  "superseded"
)

export const LibrarySyncEvent = Schema.Struct({
  id: Schema.String,
  sourceEventId: Schema.NullOr(Schema.String),
  malId: MalId,
  provider: ExternalListProvider,
  action: LibrarySyncAction,
  status: LibrarySyncStatus,
  title: Schema.String,
  attempts: Schema.NonNegativeInt,
  errorMessage: Schema.NullOr(Schema.String),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
})
export type LibrarySyncEvent = typeof LibrarySyncEvent.Type

export const LibrarySyncEventPage = Schema.Struct({
  items: Schema.Array(LibrarySyncEvent),
  page: Schema.Int.pipe(Schema.positive()),
  perPage: Schema.Int.pipe(Schema.positive()),
  total: Schema.NonNegativeInt,
  totalPages: Schema.Int.pipe(Schema.positive()),
})

export const LibrarySyncRetryTarget = Schema.Union(
  Schema.Struct({ type: Schema.Literal("original") }),
  Schema.Struct({ type: Schema.Literal("all_linked") }),
  Schema.Struct({
    type: Schema.Literal("selected"),
    providers: Schema.Array(ExternalListProvider).pipe(Schema.minItems(1)),
  })
)

export const LibrarySyncRetryResult = Schema.Struct({
  queued: Schema.Array(LibrarySyncEvent),
})

export class LibraryOperationError extends Schema.TaggedError<LibraryOperationError>()(
  "LibraryOperationError",
  { message: Schema.String }
) {}

export class LibraryEntryNotFoundError extends Schema.TaggedError<LibraryEntryNotFoundError>()(
  "LibraryEntryNotFoundError",
  { malId: MalId, message: Schema.String }
) {}

