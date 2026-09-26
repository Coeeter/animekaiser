import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

export class AniZipRequestError extends Schema.TaggedError<AniZipRequestError>()(
  "AniZipRequestError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}

export const EpisodeMetadata = Schema.Struct({
  number: Schema.Int.pipe(Schema.positive()),
  image: Schema.NullOr(Schema.String),
  airedAt: Schema.NullOr(Schema.String),
})
export type EpisodeMetadata = typeof EpisodeMetadata.Type

const AniZipEpisode = Schema.Struct({
  image: Schema.optional(Schema.NullOr(Schema.String)),
  airDateUtc: Schema.optional(Schema.NullOr(Schema.String)),
})

const AniZipMappings = Schema.Struct({
  episodes: Schema.optional(
    Schema.NullOr(Schema.Record({ key: Schema.String, value: AniZipEpisode }))
  ),
})

// ani.zip keys regular episodes by their number within this MAL entry and
// specials as "S<n>", which have no AnimeKaiser episode to attach to.
export const episodeMetadata = (
  mappings: typeof AniZipMappings.Type
): Array<EpisodeMetadata> =>
  Object.entries(mappings.episodes ?? {})
    .flatMap(([key, episode]) => {
      const number = Number(key)
      return /^\d+$/.test(key) && number > 0
        ? [
            {
              number,
              image: episode.image?.trim() || null,
              airedAt: episode.airDateUtc?.trim() || null,
            },
          ]
        : []
    })
    .sort((left, right) => left.number - right.number)

export class AniZipService extends Effect.Service<AniZipService>()(
  "@animekaiser/core/AniZipService",
  {
    accessors: true,
    dependencies: [FetchHttpClient.layer],
    effect: Effect.gen(function* () {
      const http = (yield* HttpClient.HttpClient).pipe(
        HttpClient.withTracerPropagation(false)
      )

      const getEpisodeMetadata = Effect.fn("AniZipService.getEpisodeMetadata")(
        function* (malId: number) {
          const mappings = yield* http
            .execute(
              HttpClientRequest.get(
                `https://api.ani.zip/mappings?mal_id=${malId}`
              )
            )
            .pipe(
              Effect.flatMap(HttpClientResponse.filterStatusOk),
              Effect.flatMap(HttpClientResponse.schemaBodyJson(AniZipMappings)),
              Effect.timeout("10 seconds"),
              Effect.mapError(
                (cause) =>
                  new AniZipRequestError({
                    message: "ani.zip request failed.",
                    cause,
                  })
              )
            )
          return episodeMetadata(mappings)
        }
      )

      return { getEpisodeMetadata }
    }),
  }
) {}
