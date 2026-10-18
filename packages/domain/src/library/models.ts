import * as Schema from "effect/Schema"
import { AniListId, AnimeItem, AnimeTitle, MalId } from "../anime/models"
import { ExternalListProvider } from "../integrations/models"

export const LibraryStatus = Schema.Literals([
  "watching",
  "completed",
  "paused",
  "dropped",
  "planning",
  "rewatching",
])
export type LibraryStatus = typeof LibraryStatus.Type

export const LibrarySort = Schema.Literals([
  "updated_desc",
  "updated_asc",
  "title_asc",
  "score_desc",
  "progress_desc",
])
export type LibrarySort = typeof LibrarySort.Type

export const AnimeLibraryMetadata = Schema.Struct({
  malId: MalId,
  aniListId: Schema.NullOr(AniListId),
  title: AnimeTitle,
  coverImage: Schema.NullOr(Schema.String),
  episodes: Schema.NullOr(Schema.Int.check(Schema.isGreaterThan(0))),
  genres: Schema.optional(Schema.Array(Schema.String)),
  seasonYear: Schema.optional(
    Schema.NullOr(
      Schema.Int.check(Schema.isBetween({ minimum: 1900, maximum: 2200 }))
    )
  ),
})
export type AnimeLibraryMetadata = typeof AnimeLibraryMetadata.Type

export const LibraryEntry = Schema.Struct({
  malId: MalId,
  status: LibraryStatus,
  score: Schema.NullOr(
    Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 100 }))
  ),
  progress: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  notes: Schema.NullOr(Schema.String),
  aniListEntryId: Schema.NullOr(Schema.Int.check(Schema.isGreaterThan(0))),
  anime: AnimeLibraryMetadata,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
})
export type LibraryEntry = typeof LibraryEntry.Type

export const LibraryStats = Schema.Struct({
  total: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  byStatus: Schema.Record(
    LibraryStatus,
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  meanScore: Schema.NullOr(
    Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 100 }))
  ),
})
export type LibraryStats = typeof LibraryStats.Type

export const LibraryPage = Schema.Struct({
  items: Schema.Array(LibraryEntry),
  page: Schema.Int.check(Schema.isGreaterThan(0)),
  perPage: Schema.Int.check(Schema.isGreaterThan(0)),
  total: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  totalPages: Schema.Int.check(Schema.isGreaterThan(0)),
  stats: LibraryStats,
})
export type LibraryPage = typeof LibraryPage.Type

export const PublicLibrary = Schema.Union([
  Schema.Struct({ type: Schema.Literal("not_found") }),
  Schema.Struct({ type: Schema.Literal("private") }),
  Schema.Struct({
    type: Schema.Literal("public"),
    username: Schema.String,
    image: Schema.NullOr(Schema.String),
    page: LibraryPage,
  }),
])
export type PublicLibrary = typeof PublicLibrary.Type

export const LibraryRemovalResult = Schema.Struct({
  removed: Schema.Boolean,
  queuedProviders: Schema.Array(ExternalListProvider),
})

export const LibrarySyncAction = Schema.Literals(["upsert", "delete"])
export const LibrarySyncStatus = Schema.Literals([
  "pending",
  "running",
  "completed",
  "failed",
  "superseded",
])

export const LibrarySyncEvent = Schema.Struct({
  id: Schema.String,
  sourceEventId: Schema.NullOr(Schema.String),
  malId: MalId,
  provider: ExternalListProvider,
  action: LibrarySyncAction,
  status: LibrarySyncStatus,
  title: Schema.String,
  attempts: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  errorMessage: Schema.NullOr(Schema.String),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
})
export type LibrarySyncEvent = typeof LibrarySyncEvent.Type

export const LibrarySyncEventPage = Schema.Struct({
  items: Schema.Array(LibrarySyncEvent),
  page: Schema.Int.check(Schema.isGreaterThan(0)),
  perPage: Schema.Int.check(Schema.isGreaterThan(0)),
  total: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  totalPages: Schema.Int.check(Schema.isGreaterThan(0)),
})

export const LibrarySyncRetryTarget = Schema.Union([
  Schema.Struct({ type: Schema.Literal("original") }),
  Schema.Struct({ type: Schema.Literal("all_linked") }),
  Schema.Struct({
    type: Schema.Literal("selected"),
    providers: Schema.Array(ExternalListProvider).check(Schema.isMinLength(1)),
  }),
])

export const LibrarySyncRetryResult = Schema.Struct({
  queued: Schema.Array(LibrarySyncEvent),
})

export const LibraryNewEpisode = Schema.Struct({
  anime: AnimeLibraryMetadata,
  status: LibraryStatus,
  progress: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  latestAiredEpisode: Schema.Int.check(Schema.isGreaterThan(0)),
  latestAiredAt: Schema.NullOr(Schema.DateFromString),
  availableEpisode: Schema.NullOr(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  nextEpisode: Schema.NullOr(Schema.Int.check(Schema.isGreaterThan(0))),
  nextAiringAt: Schema.NullOr(Schema.DateFromString),
  nextEpisodeImage: Schema.NullOr(Schema.String),
})
export type LibraryNewEpisode = typeof LibraryNewEpisode.Type

export const LibraryNextSeason = Schema.Struct({
  from: AnimeLibraryMetadata,
  next: AnimeItem,
  completedAt: Schema.DateFromString,
})
export type LibraryNextSeason = typeof LibraryNextSeason.Type

export class LibraryOperationError extends Schema.TaggedError<LibraryOperationError>()(
  "LibraryOperationError",
  { message: Schema.String }
) {}

export class LibraryEntryNotFoundError extends Schema.TaggedError<LibraryEntryNotFoundError>()(
  "LibraryEntryNotFoundError",
  { malId: MalId, message: Schema.String }
) {}
