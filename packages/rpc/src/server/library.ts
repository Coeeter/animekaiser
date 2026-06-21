import {
  ExternalListAccountsService,
  LibraryImportService,
  LibraryService,
} from "@workspace/core/server"
import {
  ExternalListOperationError,
  LibraryOperationError,
  LibraryRpcs,
} from "@workspace/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import { RpcSession } from "./session"

const libraryError = (error: { message: string }) =>
  new LibraryOperationError({ message: error.message })
const externalError = (error: { message: string }) =>
  new ExternalListOperationError({ message: error.message })

export const LibraryHandlersLive = LibraryRpcs.toLayer(
  Effect.gen(function* () {
    const sessions = yield* RpcSession
    const imports = yield* LibraryImportService
    return LibraryRpcs.of({
      GetLibraryPage: (input, options) =>
        Effect.gen(function* () {
          const user = yield* sessions.requireUser(options.headers)
          return yield* LibraryService.getPage(user.id, input)
        }).pipe(Effect.catchTag("LibraryServiceError", (error) => Effect.fail(libraryError(error)))),
      GetLibraryEntry: ({ malId }, options) =>
        Effect.gen(function* () {
          const user = yield* sessions.requireUser(options.headers)
          return yield* LibraryService.getEntry(user.id, malId)
        }).pipe(Effect.catchTag("LibraryServiceError", (error) => Effect.fail(libraryError(error)))),
      UpsertLibraryEntry: ({ anime, status, score, progress, notes }, options) =>
        Effect.gen(function* () {
          const user = yield* sessions.requireUser(options.headers)
          const entry = yield* LibraryService.upsertEntry(user.id, anime, {
            status,
            score,
            progress,
            notes,
          })
          return yield* entry
            ? Effect.succeed(entry)
            : Effect.fail(new LibraryOperationError({ message: "Library entry was not saved." }))
        }).pipe(Effect.catchTag("LibraryServiceError", (error) => Effect.fail(libraryError(error)))),
      RemoveLibraryEntry: ({ malId, providers }, options) =>
        Effect.gen(function* () {
          const user = yield* sessions.requireUser(options.headers)
          return yield* LibraryService.removeEntry(user.id, malId, providers)
        }).pipe(Effect.catchTag("LibraryServiceError", (error) => Effect.fail(libraryError(error)))),
      ClearLibrary: (_, options) =>
        Effect.gen(function* () {
          const user = yield* sessions.requireUser(options.headers)
          return { removedCount: yield* LibraryService.clear(user.id) }
        }).pipe(Effect.catchTag("LibraryServiceError", (error) => Effect.fail(libraryError(error)))),
      StartLibraryImport: ({ provider }, options) =>
        Effect.gen(function* () {
          const user = yield* sessions.requireUser(options.headers)
          return yield* ExternalListAccountsService.startImport(user.id, provider)
        }).pipe(Effect.catchTag("ExternalListAccountError", (error) => Effect.fail(externalError(error)))),
      WatchLibraryImport: ({ id }, options) =>
        Stream.unwrap(
          sessions.requireUser(options.headers).pipe(
            Effect.map((user) =>
              imports.watchJob(user.id, id).pipe(Stream.mapError(externalError))
            )
          )
        ),
      ListLibrarySyncEvents: (input, options) =>
        Effect.gen(function* () {
          const user = yield* sessions.requireUser(options.headers)
          return yield* LibraryService.listSyncEvents(user.id, input)
        }).pipe(Effect.catchTag("LibraryServiceError", (error) => Effect.fail(libraryError(error)))),
      RetryLibrarySyncEvents: ({ eventIds, target }, options) =>
        Effect.gen(function* () {
          const user = yield* sessions.requireUser(options.headers)
          const queued = yield* LibraryService.retrySyncEvents(user.id, eventIds, target)
          return {
            queued: queued.map((event) => ({
              id: event.id,
              sourceEventId: event.sourceEventId,
              malId: event.malId,
              provider: event.provider,
              action: event.action,
              status: event.status,
              title: `MAL ${event.malId}`,
              attempts: event.attempts,
              errorMessage: event.errorMessage,
              createdAt: event.createdAt,
              updatedAt: event.updatedAt,
            })),
          }
        }).pipe(Effect.catchTag("LibraryServiceError", (error) => Effect.fail(libraryError(error)))),
    })
  })
).pipe(
  Layer.provide(
    Layer.mergeAll(
      RpcSession.Default,
      ExternalListAccountsService.Default,
      LibraryImportService.Default,
      LibraryService.Default
    )
  )
)
