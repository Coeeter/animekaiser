import { Rpc, RpcGroup } from "@effect/rpc"
import * as Schema from "effect/Schema"
import { Authentication } from "../auth/rpc"
import { MalId } from "../anime/models"
import {
  ExternalListOperationError,
  ExternalListProvider,
  LibraryImportJob,
} from "../integrations/models"
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
} from "./models"

export class GetLibraryPage extends Rpc.make("GetLibraryPage", {
  payload: {
    status: Schema.optional(LibraryStatus),
    sort: LibrarySort,
    page: Schema.Int.pipe(Schema.positive()),
    perPage: Schema.Int.pipe(Schema.between(1, 100)),
  },
  success: LibraryPage,
  error: LibraryOperationError,
}) {}

export class GetLibraryEntry extends Rpc.make("GetLibraryEntry", {
  payload: { malId: MalId },
  success: Schema.NullOr(LibraryEntry),
  error: LibraryOperationError,
}) {}

export class UpsertLibraryEntry extends Rpc.make("UpsertLibraryEntry", {
  payload: {
    anime: AnimeLibraryMetadata,
    status: LibraryStatus,
    score: Schema.NullOr(Schema.Int.pipe(Schema.between(0, 100))),
    progress: Schema.NonNegativeInt,
    notes: Schema.NullOr(Schema.String.pipe(Schema.maxLength(2000))),
    syncExternal: Schema.optional(Schema.Boolean),
  },
  success: LibraryEntry,
  error: LibraryOperationError,
}) {}

export class RemoveLibraryEntry extends Rpc.make("RemoveLibraryEntry", {
  payload: { malId: MalId, providers: Schema.Array(ExternalListProvider) },
  success: LibraryRemovalResult,
  error: LibraryOperationError,
}) {}

export class ClearLibrary extends Rpc.make("ClearLibrary", {
  success: Schema.Struct({ removedCount: Schema.NonNegativeInt }),
  error: LibraryOperationError,
}) {}

export class StartLibraryImport extends Rpc.make("StartLibraryImport", {
  payload: { provider: ExternalListProvider },
  success: LibraryImportJob,
  error: ExternalListOperationError,
}) {}

export class WatchLibraryImport extends Rpc.make("WatchLibraryImport", {
  payload: { id: Schema.String },
  success: LibraryImportJob,
  error: ExternalListOperationError,
  stream: true,
}) {}

export class ListLibrarySyncEvents extends Rpc.make("ListLibrarySyncEvents", {
  payload: {
    page: Schema.Int.pipe(Schema.positive()),
    perPage: Schema.Int.pipe(Schema.between(1, 100)),
    status: Schema.optional(
      Schema.Literal("pending", "running", "completed", "failed", "superseded")
    ),
    provider: Schema.optional(ExternalListProvider),
  },
  success: LibrarySyncEventPage,
  error: LibraryOperationError,
}) {}

export class RetryLibrarySyncEvents extends Rpc.make("RetryLibrarySyncEvents", {
  payload: {
    eventIds: Schema.Array(Schema.String).pipe(Schema.minItems(1)),
    target: LibrarySyncRetryTarget,
  },
  success: LibrarySyncRetryResult,
  error: LibraryOperationError,
}) {}

export class LibraryRpcs extends RpcGroup.make(
  GetLibraryPage,
  GetLibraryEntry,
  UpsertLibraryEntry,
  RemoveLibraryEntry,
  ClearLibrary,
  StartLibraryImport,
  WatchLibraryImport,
  ListLibrarySyncEvents,
  RetryLibrarySyncEvents
).middleware(Authentication) {}
