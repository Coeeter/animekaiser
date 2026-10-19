import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as KeyValueStore from "effect/persistence/KeyValueStore"
import type * as Schema from "effect/Schema"

// Decodes a raw stored string the way `Atom.kvs` reads it, for tests of what
// survives from older app versions.
export const decodeStored = <A, I>(
  schema: Schema.Codec<A, I>,
  raw: string
): Option.Option<A> =>
  Effect.gen(function* () {
    const store = yield* KeyValueStore.KeyValueStore
    yield* store.set("key", raw)
    return yield* KeyValueStore.toSchemaStore(store, schema).get("key")
  }).pipe(
    Effect.orElseSucceed(() => Option.none()),
    Effect.provide(KeyValueStore.layerMemory),
    Effect.runSync
  )
