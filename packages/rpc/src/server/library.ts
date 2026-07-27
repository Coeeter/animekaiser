import {
  ExternalListAccountsService,
  LibraryImportService,
  LibraryService,
} from "@animekaiser/core"
import {
  CurrentUser,
  ExternalListOperationError,
  LibraryOperationError,
  LibraryRpcs,
} from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"

export const LibraryHandlersLive = LibraryRpcs.toLayer(
  Effect.gen(function* () {
    const imports = yield* LibraryImportService
    return LibraryRpcs.of({
      GetLibraryPage: (input) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* LibraryService.getPage(user.id, input).pipe(
            Effect.catchTag("LibraryServiceError", (error) =>
              Effect.fail(new LibraryOperationError({ message: error.message }))
            )
          )
        }),
      GetLibraryEntry: ({ malId }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* LibraryService.getEntry(user.id, malId).pipe(
            Effect.catchTag("LibraryServiceError", (error) =>
              Effect.fail(new LibraryOperationError({ message: error.message }))
            )
          )
        }),
      UpsertLibraryEntry: ({
        anime,
        status,
        score,
        progress,
        notes,
        syncExternal,
      }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const entry = yield* LibraryService.upsertEntry(
            user.id,
            anime,
            {
              status,
              score,
              progress,
              notes,
            },
            syncExternal ?? true
          ).pipe(
            Effect.catchTag("LibraryServiceError", (error) =>
              Effect.fail(new LibraryOperationError({ message: error.message }))
            )
          )
          return yield* entry
            ? Effect.succeed(entry)
            : new LibraryOperationError({
                message: "Library entry was not saved.",
              })
        }),
      RemoveLibraryEntry: ({ malId, providers }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* LibraryService.removeEntry(
            user.id,
            malId,
            providers
          ).pipe(
            Effect.catchTag("LibraryServiceError", (error) =>
              Effect.fail(new LibraryOperationError({ message: error.message }))
            )
          )
        }),
      ClearLibrary: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const removedCount = yield* LibraryService.clear(user.id).pipe(
            Effect.catchTag("LibraryServiceError", (error) =>
              Effect.fail(new LibraryOperationError({ message: error.message }))
            )
          )
          return { removedCount }
        }),
      StartLibraryImport: ({ provider }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* ExternalListAccountsService.startImport(
            user.id,
            provider
          ).pipe(
            Effect.catchTag("ExternalListAccountError", (error) =>
              Effect.fail(
                new ExternalListOperationError({ message: error.message })
              )
            )
          )
        }),
      WatchLibraryImport: ({ id }) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const user = yield* CurrentUser
            return imports
              .watchJob(user.id, id)
              .pipe(
                Stream.mapError(
                  (error) =>
                    new ExternalListOperationError({ message: error.message })
                )
              )
          })
        ),
      ListLibrarySyncEvents: (input) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* LibraryService.listSyncEvents(user.id, input).pipe(
            Effect.catchTag("LibraryServiceError", (error) =>
              Effect.fail(new LibraryOperationError({ message: error.message }))
            )
          )
        }),
      RetryLibrarySyncEvents: ({ eventIds, target }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const queued = yield* LibraryService.retrySyncEvents(
            user.id,
            eventIds,
            target
          ).pipe(
            Effect.catchTag("LibraryServiceError", (error) =>
              Effect.fail(new LibraryOperationError({ message: error.message }))
            )
          )
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
        }),
    })
  })
).pipe(
  Layer.provide(
    Layer.mergeAll(
      ExternalListAccountsService.Default,
      LibraryImportService.Default,
      LibraryService.Default
    )
  )
)
