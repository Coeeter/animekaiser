import { SocialService } from "@animekaiser/core"
import { CurrentUser, SocialRpcs } from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export const SocialHandlersLive = SocialRpcs.toLayer(
  Effect.gen(function* () {
    const social = yield* SocialService
    const asUser = <A, E>(run: (userId: string) => Effect.Effect<A, E>) =>
      Effect.flatMap(CurrentUser, (user) => run(user.id))
    return SocialRpcs.of({
      SearchUsers: ({ query }) => asUser((id) => social.search(id, query)),
      ListFriends: () => asUser((id) => social.overview(id)),
      GetFriendRelation: ({ username }) =>
        asUser((id) => social.relation(id, username)),
      SendFriendRequest: ({ userId }) =>
        asUser((id) => social.sendRequest(id, userId)),
      RespondFriendRequest: ({ userId, accept }) =>
        asUser((id) => social.respond(id, userId, accept)),
      RemoveFriendship: ({ userId }) =>
        asUser((id) => social.remove(id, userId)),
    })
  })
).pipe(Layer.provide(SocialService.layer))
