import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { KeyValueStore } from "../key-value-store"

export class AnimeCacheError extends Data.TaggedError("AnimeCacheError")<{
  message: string
  cause?: unknown
}> {}

export class AnimeCache extends Effect.Service<AnimeCache>()(
  "@animekaiser/core/AnimeCache",
  {
    effect: Effect.gen(function* () {
      const storage = yield* KeyValueStore
      return {
        get: <TValue, TEncoded>(
          key: string,
          schema: Schema.Schema<TValue, TEncoded>
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
              return Schema.decodeUnknown(Schema.parseJson(schema))(value).pipe(
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
          schema: Schema.Schema<TValue, TEncoded>,
          value: TValue,
          ttlSeconds: number
        ) =>
          Schema.encode(Schema.parseJson(schema))(value).pipe(
            Effect.flatMap((encoded) => storage.set(key, encoded, ttlSeconds)),
            Effect.mapError((cause) =>
              cause instanceof AnimeCacheError
                ? cause
                : new AnimeCacheError({
                    message: "Cache write failed.",
                    cause,
                  })
            )
          ),
      }
    }),
  }
) {}
