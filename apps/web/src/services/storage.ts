import * as KeyValueStore from "effect/persistence/KeyValueStore"
import * as Atom from "effect/reactivity/Atom"

// Storage can be missing (no window) or throw (privacy modes, quota). Reads that
// fail leave an atom at its default, and failed writes keep the in-memory value.
const storageLayer = (storage: () => Storage) =>
  typeof window === "undefined"
    ? KeyValueStore.layerMemory
    : KeyValueStore.layerStorage(storage)

export const localStorageRuntime = Atom.runtime(
  storageLayer(() => window.localStorage)
)

export const sessionStorageRuntime = Atom.runtime(
  storageLayer(() => window.sessionStorage)
)
