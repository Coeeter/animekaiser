import { RecommendationService } from "@animekaiser/core"
import { CurrentUser, RecommendationRpcs, RoomActor } from "@animekaiser/domain"
import * as Effect from "effect/Effect"

export const RecommendationHandlersLive = RecommendationRpcs.toLayer(
  Effect.gen(function* () {
    const ai = yield* RecommendationService
    const asUser = <A, E>(run: (userId: string) => Effect.Effect<A, E>) =>
      Effect.flatMap(CurrentUser, (user) => run(user.id))
    return RecommendationRpcs.of({
      ListRecommendationThreads: () => asUser((id) => ai.list(id)),
      GetAiPreferences: () => asUser((id) => ai.getPreferences(id)),
      SaveAiPreferences: ({ notes }) =>
        asUser((id) => ai.savePreferences(id, notes)),
      RenameRecommendationThread: ({ threadId, title }) =>
        asUser((id) => ai.rename(id, threadId, title)),
      DeleteRecommendationThread: ({ threadId }) =>
        asUser((id) => ai.remove(id, threadId)),
      ShareRecommendationToRoom: (input) => asUser((id) => ai.share(id, input)),
      GetAiAvailability: ({ roomId }) =>
        Effect.flatMap(RoomActor, (actor) => ai.availability(actor, roomId)),
      CreateRecommendationThread: (input) =>
        Effect.flatMap(RoomActor, (actor) => ai.create(actor, input)),
      GetRecommendationThread: ({ threadId }) =>
        Effect.flatMap(RoomActor, (actor) => ai.get(actor, threadId)),
      SendRecommendationMessage: (input) =>
        Effect.flatMap(RoomActor, (actor) => ai.send(actor, input)),
      StopRecommendation: ({ threadId }) =>
        Effect.flatMap(RoomActor, (actor) => ai.stop(actor, threadId)),
      AskRoomAi: ({ roomId, requestId, content }) =>
        Effect.flatMap(RoomActor, (actor) =>
          ai.askRoom(actor, roomId, requestId, content)
        ),
      StopRoomAi: ({ roomId }) =>
        Effect.flatMap(RoomActor, (actor) => ai.stopRoom(actor, roomId)),
    })
  })
)
