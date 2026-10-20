import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as KeyValueStore from "effect/persistence/KeyValueStore"
import * as Atom from "effect/reactivity/Atom"

// Storage can be missing (no window) or throw (privacy modes, quota). Reads that
// fail leave an atom at its default, and failed writes keep the in-memory value.
const storageLayer = (storage: () => Storage) =>
  typeof window === "undefined"
    ? KeyValueStore.layerMemory
    : KeyValueStore.layerStorage(storage)

// Earlier builds stored these as raw strings; Atom.kvs reads JSON.
const legacyStringKeys = ["anime-title-preference", "kaiser.activeRoom"]

const upgradeLegacyStrings = Layer.effectDiscard(
  Effect.gen(function* () {
    const store = yield* KeyValueStore.KeyValueStore
    for (const key of legacyStringKeys) {
      const raw = yield* store.get(key)
      if (raw !== undefined && raw !== "null" && !raw.startsWith('"'))
        yield* store.set(key, JSON.stringify(raw))
    }
  }).pipe(Effect.ignore)
)

export const localStorageRuntime = Atom.runtime(
  Layer.provideMerge(
    upgradeLegacyStrings,
    storageLayer(() => window.localStorage)
  )
)

export const sessionStorageRuntime = Atom.runtime(
  storageLayer(() => window.sessionStorage)
)
