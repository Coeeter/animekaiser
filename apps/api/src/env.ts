import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Redacted from "effect/Redacted"

export class Env extends Effect.Service<Env>()("@workspace/api/env", {
  accessors: true,
  effect: Effect.gen(function* () {
    return {
      server: {
        port: yield* Config.integer("PORT").pipe(Config.withDefault(8080)),
        env: yield* Config.literal(
          "dev",
          "prod"
        )("ENV").pipe(Config.withDefault("dev")),
      },
      app: {
        url: yield* Config.nonEmptyString("APP_URL"),
      },
      database: {
        url: yield* Config.nonEmptyString("DATABASE_URL"),
      },
      redis: {
        url: yield* Config.nonEmptyString("REDIS_URL"),
      },
      auth: {
        url: yield* Config.nonEmptyString("BETTER_AUTH_URL"),
        secret: yield* Config.nonEmptyString("BETTER_AUTH_SECRET").pipe(
          Config.map(Redacted.make)
        ),
        email: {
          resendApiKey: yield* Config.nonEmptyString("RESEND_API_KEY").pipe(
            Config.map(Redacted.make)
          ),
          from: yield* Config.nonEmptyString("AUTH_EMAIL_FROM"),
        },
      },
      externalList: {
        mal: {
          clientId: yield* Config.nonEmptyString("MAL_CLIENT_ID"),
          clientSecret: yield* Config.nonEmptyString("MAL_CLIENT_SECRET").pipe(
            Config.map(Redacted.make)
          ),
        },
        aniList: {
          clientId: yield* Config.nonEmptyString("ANILIST_CLIENT_ID"),
          clientSecret: yield* Config.nonEmptyString(
            "ANILIST_CLIENT_SECRET"
          ).pipe(Config.map(Redacted.make)),
        },
      },
    }
  }),
}) {}
