import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { KeyValueStore } from "../key-value-store"

export class AnimeCacheError extends Data.TaggedError("AnimeCacheError")<{
  message: string
  cause?: unknown
}> {}

export class AnimeCache extends Context.Service<AnimeCache>()(
  "@animekaiser/core/AnimeCache",
  {
    make: Effect.gen(function* () {
      const storage = yield* KeyValueStore
      return {
        get: <TValue, TEncoded>(
          key: string,
          schema: Schema.Codec<TValue, TEncoded>
        ) =>
          storage.get(key).pipe(
            Effect.mapError(
              (cause) =>
                new AnimeCacheError({
                  message: "Cache read failed.",
                  cause,
                })
            ),
            Effect.flatMap((value) => {
              if (value === null) return Effect.succeed(Option.none<TValue>())
              return Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(
                value
              ).pipe(
                Effect.map(Option.some),
                Effect.mapError(
                  (cause) =>
                    new AnimeCacheError({
                      message: "Cached value is invalid.",
                      cause,
                    })
                )
              )
            })
          ),
        set: <TValue, TEncoded>(
          key: string,
          schema: Schema.Codec<TValue, TEncoded>,
          value: TValue,
          ttlSeconds: number
        ) =>
          Schema.encodeEffect(Schema.fromJsonString(schema))(value).pipe(
            Effect.flatMap((encoded) => storage.set(key, encoded, ttlSeconds)),
            Effect.mapError(
              (cause) =>
                new AnimeCacheError({ message: "Cache write failed.", cause })
            )
          ),
      }
    }),
  }
) {
  static readonly layer = Layer.effect(AnimeCache, AnimeCache.make)
}
