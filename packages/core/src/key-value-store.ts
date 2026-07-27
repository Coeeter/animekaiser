import * as Context from "effect/Context"
import * as Data from "effect/Data"
import type * as Effect from "effect/Effect"

export class KeyValueStoreError extends Data.TaggedError("KeyValueStoreError")<{
  cause: unknown
}> {}

export class KeyValueStore extends Context.Tag(
  "@animekaiser/core/KeyValueStore"
)<
  KeyValueStore,
  {
    get: (key: string) => Effect.Effect<string | null, KeyValueStoreError>
    getDelete: (key: string) => Effect.Effect<string | null, KeyValueStoreError>
    set: (
      key: string,
      value: string,
      ttlSeconds: number
    ) => Effect.Effect<void, KeyValueStoreError>
  }
>() {}
