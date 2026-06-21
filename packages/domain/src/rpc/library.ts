import { Rpc, RpcGroup } from "@effect/rpc"
import * as Schema from "effect/Schema"
import { AuthenticationRequiredError } from "../auth"
import {
  ExternalListProvider,
  LibraryImportJob,
  ExternalListOperationError,
} from "../external-list"
import {
  AnimeLibraryMetadata,
  LibraryEntry,
  LibraryOperationError,
  LibraryPage,
  LibraryRemovalResult,
  LibrarySort,
  LibraryStatus,
  LibrarySyncEventPage,
  LibrarySyncRetryResult,
  LibrarySyncRetryTarget,
} from "../library"
import { MalId } from "../anime"

const libraryFailure = Schema.Union(
  AuthenticationRequiredError,
  LibraryOperationError
)
const importFailure = Schema.Union(
  AuthenticationRequiredError,
  ExternalListOperationError
)

export const LibraryRpcs = RpcGroup.make(
  Rpc.make("GetLibraryPage", {
    payload: {
      status: Schema.optional(LibraryStatus),
      sort: LibrarySort,
      page: Schema.Int.pipe(Schema.positive()),
      perPage: Schema.Int.pipe(Schema.between(1, 100)),
    },
    success: LibraryPage,
    error: libraryFailure,
  }),
  Rpc.make("GetLibraryEntry", {
    payload: { malId: MalId },
    success: Schema.NullOr(LibraryEntry),
    error: libraryFailure,
  }),
  Rpc.make("UpsertLibraryEntry", {
    payload: {
      anime: AnimeLibraryMetadata,
      status: LibraryStatus,
      score: Schema.NullOr(Schema.Int.pipe(Schema.between(0, 100))),
      progress: Schema.NonNegativeInt,
      notes: Schema.NullOr(Schema.String.pipe(Schema.maxLength(2000))),
    },
    success: LibraryEntry,
    error: libraryFailure,
  }),
  Rpc.make("RemoveLibraryEntry", {
    payload: { malId: MalId, providers: Schema.Array(ExternalListProvider) },
    success: LibraryRemovalResult,
    error: libraryFailure,
  }),
  Rpc.make("ClearLibrary", {
    success: Schema.Struct({ removedCount: Schema.NonNegativeInt }),
    error: libraryFailure,
  }),
  Rpc.make("StartLibraryImport", {
    payload: { provider: ExternalListProvider },
    success: LibraryImportJob,
    error: importFailure,
  }),
  Rpc.make("WatchLibraryImport", {
    payload: { id: Schema.String },
    success: LibraryImportJob,
    error: importFailure,
    stream: true,
  }),
  Rpc.make("ListLibrarySyncEvents", {
    payload: {
      page: Schema.Int.pipe(Schema.positive()),
      perPage: Schema.Int.pipe(Schema.between(1, 100)),
      status: Schema.optional(
        Schema.Literal(
          "pending",
          "running",
          "completed",
          "failed",
          "superseded"
        )
      ),
      provider: Schema.optional(ExternalListProvider),
    },
    success: LibrarySyncEventPage,
    error: libraryFailure,
  }),
  Rpc.make("RetryLibrarySyncEvents", {
    payload: {
      eventIds: Schema.Array(Schema.String).pipe(Schema.minItems(1)),
      target: LibrarySyncRetryTarget,
    },
    success: LibrarySyncRetryResult,
    error: libraryFailure,
  })
)
