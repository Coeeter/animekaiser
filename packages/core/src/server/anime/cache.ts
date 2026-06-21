import type * as Schema from "effect/Schema"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"

export class AnimeCacheError extends Data.TaggedError("AnimeCacheError")<{
  message: string
  cause?: unknown
}> {}

export class AnimeCache extends Context.Tag("@workspace/core/server/AnimeCache")<
  AnimeCache,
  {
    get: <TValue, TEncoded>(
      key: string,
      schema: Schema.Schema<TValue, TEncoded>
    ) => Effect.Effect<Option.Option<TValue>, AnimeCacheError>
    set: <TValue, TEncoded>(
      key: string,
      schema: Schema.Schema<TValue, TEncoded>,
      value: TValue,
      ttlSeconds: number
    ) => Effect.Effect<void, AnimeCacheError>
  }
>() {}
