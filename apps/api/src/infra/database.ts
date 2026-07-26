import { Database } from "@workspace/db"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Env } from "../env"

export function makeDatabaseLive(migrationsFolder: string) {
  return Layer.unwrapEffect(
    Env.pipe(
      Effect.map((env) =>
        Database.Default({
          url: env.database.url,
          ssl: env.server.env === "prod",
          migrationsFolder,
        })
      )
    )
  )
}

export const DatabaseListenerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const database = yield* Database
    yield* database.setupConnectionListeners
  })
)
