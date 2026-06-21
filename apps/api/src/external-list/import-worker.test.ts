import { expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import { drainLibraryImportJobs } from "./import-worker"

test("drains jobs until the queue is empty", async () => {
  const calls = await Effect.runPromise(
    Effect.gen(function* () {
      const counter = yield* Ref.make(0)
      const processNextJob = Ref.updateAndGet(
        counter,
        (count) => count + 1
      ).pipe(Effect.map((count) => count < 3))

      yield* drainLibraryImportJobs(processNextJob)
      return yield* Ref.get(counter)
    })
  )

  expect(calls).toBe(3)
})
