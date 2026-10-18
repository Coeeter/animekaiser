import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { withoutTracePropagation } from "../http"
import { makeThrottle, throttleStoreLayer } from "../throttle"

export class ShikimoriRequestError extends Schema.TaggedError<ShikimoriRequestError>()(
  "ShikimoriRequestError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}

// Shikimori ids are MAL ids, and `source_id → target_id` reads as "target is
// the <relation> of source".
export const ShikimoriFranchise = Schema.Struct({
  links: Schema.Array(
    Schema.Struct({
      source_id: Schema.Int,
      target_id: Schema.Int,
      relation: Schema.String,
    })
  ),
  nodes: Schema.Array(Schema.Struct({ id: Schema.Int })),
})
export type ShikimoriFranchise = typeof ShikimoriFranchise.Type

// shikimori.one is geoblocked in some regions; .io is the current domain.
const baseUrl = "https://shikimori.io/api"

export class ShikimoriService extends Context.Service<ShikimoriService>()(
  "@animekaiser/core/ShikimoriService",
  {
    make: Effect.gen(function* () {
      const http = (yield* HttpClient.HttpClient).pipe(withoutTracePropagation)
      // Documented limits are 5 rps and 90 rpm; requests without an app
      // User-Agent risk an IP ban.
      const throttle = yield* makeThrottle([
        { key: "shikimori:second", limit: 4, window: "1 second" },
        { key: "shikimori:minute", limit: 80, window: "1 minute" },
      ])

      const getFranchise = Effect.fn("ShikimoriService.getFranchise")(
        function* (malId: number) {
          return yield* throttle(
            http.execute(
              HttpClientRequest.get(`${baseUrl}/animes/${malId}/franchise`, {
                headers: {
                  accept: "application/json",
                  "user-agent": "AnimeKaiser",
                },
              })
            )
          ).pipe(
            Effect.flatMap(HttpClientResponse.filterStatusOk),
            Effect.flatMap(
              HttpClientResponse.schemaBodyJson(ShikimoriFranchise)
            ),
            Effect.timeout("10 seconds"),
            Effect.mapError(
              (cause) =>
                new ShikimoriRequestError({
                  message: "Shikimori franchise request failed.",
                  cause,
                })
            )
          )
        }
      )

      return { getFranchise }
    }),
  }
) {
  static readonly layer = Layer.effect(
    ShikimoriService,
    ShikimoriService.make
  ).pipe(Layer.provide([FetchHttpClient.layer, throttleStoreLayer]))
}
