import { expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { KeyValueStore } from "../key-value-store"
import { ExternalListOAuthStateStore } from "./oauth"

test("stores OAuth state under the returned id and consumes it once", async () => {
  const values = new Map<string, string>()
  const storage = Layer.succeed(
    KeyValueStore,
    KeyValueStore.of({
      get: (key) => Effect.succeed(values.get(key) ?? null),
      getDelete: (key) =>
        Effect.sync(() => {
          const value = values.get(key) ?? null
          values.delete(key)
          return value
        }),
      set: (key, value) =>
        Effect.sync(() => {
          values.set(key, value)
        }),
    })
  )
  const live = ExternalListOAuthStateStore.Default.pipe(Layer.provide(storage))
  const state = {
    callbackURL: "https://kaiser.test/settings",
    codeVerifier: "verifier",
    userId: "user-1",
  }

  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* ExternalListOAuthStateStore
      const id = yield* store.create(state)
      return {
        first: yield* store.take(id),
        second: yield* store.take(id),
      }
    }).pipe(Effect.provide(live))
  )

  expect(result.first).toEqual(state)
  expect(result.second).toBeUndefined()
})
