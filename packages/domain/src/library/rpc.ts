import { Rpc, RpcGroup } from "effect/rpc"
import * as Schema from "effect/Schema"
import { MalId } from "../anime/models"
import { Authentication, OptionalAuthentication } from "../auth/rpc"
import {
  ExternalListOperationError,
  ExternalListProvider,
  LibraryImportJob,
} from "../integrations/models"
import {
  AnimeLibraryMetadata,
  LibraryEntry,
  LibraryNewEpisode,
  LibraryNextSeason,
  LibraryOperationError,
  LibraryPage,
  LibraryRemovalResult,
  LibrarySort,
  LibraryStatus,
  LibrarySyncEventPage,
  LibrarySyncRetryResult,
  LibrarySyncRetryTarget,
  PublicLibrary,
} from "./models"

export class GetLibraryPage extends Rpc.make("GetLibraryPage", {
  payload: {
    status: Schema.optional(LibraryStatus),
    query: Schema.optional(Schema.String.check(Schema.isMaxLength(200))),
    sort: LibrarySort,
    page: Schema.Int.check(Schema.isGreaterThan(0)),
    perPage: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
  },
  success: LibraryPage,
  error: LibraryOperationError,
}) {}

export class GetPublicLibrary extends Rpc.make("GetPublicLibrary", {
  payload: {
    username: Schema.String,
    status: Schema.optional(LibraryStatus),
    query: Schema.optional(Schema.String.check(Schema.isMaxLength(200))),
    sort: LibrarySort,
    page: Schema.Int.check(Schema.isGreaterThan(0)),
    perPage: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
    asPublic: Schema.optional(Schema.Boolean),
  },
  success: PublicLibrary,
  error: LibraryOperationError,
}) {}

export class GetLibraryEntry extends Rpc.make("GetLibraryEntry", {
  payload: { malId: MalId },
  success: Schema.NullOr(LibraryEntry),
  error: LibraryOperationError,
}) {}

export class ListLibraryEntries extends Rpc.make("ListLibraryEntries", {
  payload: { malIds: Schema.Array(MalId).check(Schema.isMaxLength(50)) },
  success: Schema.Array(LibraryEntry),
  error: LibraryOperationError,
}) {}

export class UpsertLibraryEntry extends Rpc.make("UpsertLibraryEntry", {
  payload: {
    anime: AnimeLibraryMetadata,
    status: LibraryStatus,
    score: Schema.NullOr(
      Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 100 }))
    ),
    progress: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    notes: Schema.NullOr(Schema.String.check(Schema.isMaxLength(2000))),
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
  success: Schema.Struct({
    removedCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
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
    page: Schema.Int.check(Schema.isGreaterThan(0)),
    perPage: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
    status: Schema.optional(
      Schema.Literals([
        "pending",
        "running",
        "completed",
        "failed",
        "superseded",
      ])
    ),
    provider: Schema.optional(ExternalListProvider),
  },
  success: LibrarySyncEventPage,
  error: LibraryOperationError,
}) {}

export class RetryLibrarySyncEvents extends Rpc.make("RetryLibrarySyncEvents", {
  payload: {
    eventIds: Schema.Array(Schema.String).check(Schema.isMinLength(1)),
    target: LibrarySyncRetryTarget,
  },
  success: LibrarySyncRetryResult,
  error: LibraryOperationError,
}) {}

export class ListLibraryNewEpisodes extends Rpc.make("ListLibraryNewEpisodes", {
  success: Schema.Array(LibraryNewEpisode),
  error: LibraryOperationError,
}) {}

export class ListLibraryNextSeasons extends Rpc.make("ListLibraryNextSeasons", {
  success: Schema.Array(LibraryNextSeason),
  error: LibraryOperationError,
}) {}

class PublicLibraryRpcs extends RpcGroup.make(GetPublicLibrary).middleware(
  OptionalAuthentication
) {}

class AuthenticatedLibraryRpcs extends RpcGroup.make(
  GetLibraryPage,
  GetLibraryEntry,
  ListLibraryEntries,
  UpsertLibraryEntry,
  RemoveLibraryEntry,
  ClearLibrary,
  StartLibraryImport,
  WatchLibraryImport,
  ListLibrarySyncEvents,
  RetryLibrarySyncEvents,
  ListLibraryNewEpisodes,
  ListLibraryNextSeasons
).middleware(Authentication) {}

export class LibraryRpcs extends RpcGroup.make().merge(
  PublicLibraryRpcs,
  AuthenticatedLibraryRpcs
) {}
