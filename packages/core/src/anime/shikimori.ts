import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as Effect from "effect/Effect"
import * as RateLimiter from "effect/RateLimiter"
import * as Schema from "effect/Schema"

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

export class ShikimoriService extends Effect.Service<ShikimoriService>()(
  "@animekaiser/core/ShikimoriService",
  {
    accessors: true,
    dependencies: [FetchHttpClient.layer],
    scoped: Effect.gen(function* () {
      const http = (yield* HttpClient.HttpClient).pipe(
        HttpClient.withTracerPropagation(false)
      )
      // Documented limits are 5 rps and 90 rpm; requests without an app
      // User-Agent risk an IP ban.
      const perSecond = yield* RateLimiter.make({
        limit: 4,
        interval: "1 second",
      })
      const perMinute = yield* RateLimiter.make({
        limit: 80,
        interval: "1 minute",
      })

      const getFranchise = Effect.fn("ShikimoriService.getFranchise")(
        function* (malId: number) {
          return yield* perMinute(
            perSecond(
              http.execute(
                HttpClientRequest.get(`${baseUrl}/animes/${malId}/franchise`, {
                  headers: {
                    accept: "application/json",
                    "user-agent": "AnimeKaiser",
                  },
                })
              )
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
) {}
