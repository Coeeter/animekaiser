import { Database } from "@animekaiser/db"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Env } from "../env"

export function makeDatabaseLive(migrationsFolder: string) {
  return Layer.unwrap(
    Env.pipe(
      Effect.map((env) =>
        Database.layer({
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
    return yield* database.awaitConnectionError
  })
)
