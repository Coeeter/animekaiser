import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"

export class Env extends Context.Service<Env>()("@animekaiser/api/env", {
  make: Effect.gen(function* () {
    return {
      server: {
        port: yield* Config.Port("PORT").pipe(Config.withDefault(8080)),
        env: yield* Config.Literals(["dev", "prod"], "ENV").pipe(
          Config.withDefault("dev")
        ),
      },
      app: {
        url: yield* Config.NonEmptyString("APP_URL"),
      },
      database: {
        url: yield* Config.NonEmptyString("DATABASE_URL"),
      },
      redis: {
        url: yield* Config.NonEmptyString("REDIS_URL"),
      },
      auth: {
        url: yield* Config.NonEmptyString("BETTER_AUTH_URL"),
        cookieDomain: yield* Config.String("AUTH_COOKIE_DOMAIN").pipe(
          Config.withDefault("")
        ),
        secret: yield* Config.NonEmptyString("BETTER_AUTH_SECRET").pipe(
          Config.map(Redacted.make)
        ),
        email: {
          resendApiKey: yield* Config.NonEmptyString("RESEND_API_KEY").pipe(
            Config.map(Redacted.make)
          ),
          from: yield* Config.NonEmptyString("AUTH_EMAIL_FROM"),
        },
      },
      r2: {
        endpoint: yield* Config.NonEmptyString("R2_ENDPOINT"),
        bucket: yield* Config.NonEmptyString("R2_BUCKET"),
        accessKeyId: yield* Config.NonEmptyString("R2_ACCESS_KEY_ID").pipe(
          Config.map(Redacted.make)
        ),
        secretAccessKey: yield* Config.NonEmptyString(
          "R2_SECRET_ACCESS_KEY"
        ).pipe(Config.map(Redacted.make)),
        publicUrl: yield* Config.NonEmptyString("R2_PUBLIC_URL"),
      },
      streaming: {
        url: yield* Config.NonEmptyString("STREAMING_SERVICE_URL"),
        secret: yield* Config.NonEmptyString("STREAMING_SECRET").pipe(
          Config.map(Redacted.make)
        ),
        secretHeader: yield* Config.NonEmptyString(
          "STREAMING_SECRET_HEADER"
        ).pipe(Config.withDefault("x-streaming-secret")),
      },
      ai: {
        openRouterApiKey: yield* Config.option(
          Config.Redacted("OPENROUTER_API_KEY")
        ),
      },
      externalList: {
        mal: {
          clientId: yield* Config.NonEmptyString("MAL_CLIENT_ID"),
          clientSecret: yield* Config.NonEmptyString("MAL_CLIENT_SECRET").pipe(
            Config.map(Redacted.make)
          ),
        },
        aniList: {
          clientId: yield* Config.NonEmptyString("ANILIST_CLIENT_ID"),
          clientSecret: yield* Config.NonEmptyString(
            "ANILIST_CLIENT_SECRET"
          ).pipe(Config.map(Redacted.make)),
        },
      },
    }
  }),
}) {
  static readonly layer = Layer.effect(Env, Env.make)
}
