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
  title: Schema.NullOr(Schema.String),
  overview: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
  airedAt: Schema.NullOr(Schema.String),
})
export type EpisodeMetadata = typeof EpisodeMetadata.Type

const AniZipEpisode = Schema.Struct({
  title: Schema.optional(
    Schema.NullOr(
      Schema.Record({ key: Schema.String, value: Schema.NullOr(Schema.String) })
    )
  ),
  overview: Schema.optional(Schema.NullOr(Schema.String)),
  image: Schema.optional(Schema.NullOr(Schema.String)),
  airDateUtc: Schema.optional(Schema.NullOr(Schema.String)),
})

const AniZipImage = Schema.Struct({
  coverType: Schema.String,
  url: Schema.String,
})

export const AniZipData = Schema.Struct({
  episodes: Schema.Array(EpisodeMetadata),
  logo: Schema.NullOr(Schema.String),
  fanart: Schema.NullOr(Schema.String),
})
export type AniZipData = typeof AniZipData.Type

const AniZipMappings = Schema.Struct({
  images: Schema.optional(Schema.NullOr(Schema.Array(AniZipImage))),
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
              title: episode.title?.en?.trim() || null,
              overview: episode.overview?.trim() || null,
              image: episode.image?.trim() || null,
              airedAt: episode.airDateUtc?.trim() || null,
            },
          ]
        : []
    })
    .sort((left, right) => left.number - right.number)

const imageOf = (
  mappings: typeof AniZipMappings.Type,
  coverType: "Clearlogo" | "Fanart"
) =>
  mappings.images?.find((image) => image.coverType === coverType)?.url ?? null

export const aniZipData = (
  mappings: typeof AniZipMappings.Type
): AniZipData => ({
  episodes: episodeMetadata(mappings),
  logo: imageOf(mappings, "Clearlogo"),
  fanart: imageOf(mappings, "Fanart"),
})

export class AniZipService extends Effect.Service<AniZipService>()(
  "@animekaiser/core/AniZipService",
  {
    accessors: true,
    dependencies: [FetchHttpClient.layer],
    effect: Effect.gen(function* () {
      const http = (yield* HttpClient.HttpClient).pipe(
        HttpClient.withTracerPropagation(false)
      )

      const getData = Effect.fn("AniZipService.getData")(function* (
        malId: number
      ) {
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
        return aniZipData(mappings)
      })

      return { getData }
    }),
  }
) {}
