import { WatchHistoryService } from "@animekaiser/core"
import {
  CurrentUser,
  WatchHistoryOperationError,
  WatchHistoryRpcs,
} from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

const toOperationError = (error: { message: string }) =>
  Effect.fail(new WatchHistoryOperationError({ message: error.message }))

export const WatchHistoryHandlersLive = WatchHistoryRpcs.toLayer(
  Effect.gen(function* () {
    return WatchHistoryRpcs.of({
      RecordWatchProgress: (input) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* WatchHistoryService.record(user.id, input).pipe(
            Effect.catchTag("WatchHistoryServiceError", toOperationError)
          )
        }),
      ListContinueWatching: ({ limit }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* WatchHistoryService.listContinueWatching(
            user.id,
            limit
          ).pipe(Effect.catchTag("WatchHistoryServiceError", toOperationError))
        }),
      ListWatchHistory: ({ page, perPage, query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* WatchHistoryService.listHistory(
            user.id,
            page,
            perPage,
            query
          ).pipe(Effect.catchTag("WatchHistoryServiceError", toOperationError))
        }),
      GetEpisodeWatchProgress: ({ malId, episode }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* WatchHistoryService.getEpisode(
            user.id,
            malId,
            episode
          ).pipe(Effect.catchTag("WatchHistoryServiceError", toOperationError))
        }),
      ClearWatchHistory: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* WatchHistoryService.clearAll(user.id).pipe(
            Effect.catchTag("WatchHistoryServiceError", toOperationError)
          )
        }),
      ClearWatchHistoryEntry: ({ malId }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* WatchHistoryService.clearForAnime(user.id, malId).pipe(
            Effect.catchTag("WatchHistoryServiceError", toOperationError)
          )
        }),
    })
  })
).pipe(Layer.provide(WatchHistoryService.Default))
