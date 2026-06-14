import * as Config from "effect/Config"
import * as Effect from "effect/Effect"

export class Env extends Effect.Service<Env>()("@workspace/api/env", {
  accessors: true,
  effect: Effect.gen(function* () {
    return {
      PORT: yield* Config.integer("PORT").pipe(Config.withDefault(8080)),
      ENV: yield* Config.literal(
        "dev",
        "prod"
      )("ENV").pipe(Config.withDefault("dev")),
      APP_URL: yield* Config.string("APP_URL").pipe(
        Config.withDefault("http://localhost:3000")
      ),

      DATABASE_URL: yield* Config.string("DATABASE_URL"),
    }
  }),
}) {}
