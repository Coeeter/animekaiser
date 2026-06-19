import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import { initAuth } from "@workspace/auth"
import { ExternalListOAuthConfig } from "@workspace/core/server"
import { Database } from "@workspace/db"
import { AuthenticationRequiredError } from "@workspace/domain"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import { Env } from "../env"
import { createResendAuthMailer } from "./mailer"

type BetterAuthRuntime = ReturnType<typeof initAuth>
type EnvShape = Effect.Effect.Success<typeof Env>

const providerConfig = (
  config: EnvShape["externalList"]["mal" | "aniList"],
  authBaseURL: string,
  appBaseURL: string,
  provider: "mal" | "anilist"
) => ({
  clientId: config.clientId,
  clientSecret: Redacted.value(config.clientSecret),
  redirectURI: new URL(
    `/api/link/${provider}/callback`,
    authBaseURL
  ).toString(),
  callbackBaseURL: appBaseURL,
})

export class BetterAuth extends Context.Tag("@workspace/api/auth/BetterAuth")<
  BetterAuth,
  BetterAuthRuntime
>() {}

export const requireCurrentUser = (auth: BetterAuthRuntime) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const webRequest = yield* HttpServerRequest.toWeb(request).pipe(
      Effect.mapError(
        () =>
          new AuthenticationRequiredError({
            message: "Authentication request could not be read.",
          })
      )
    )
    const session = yield* Effect.promise(() =>
      auth.api.getSession({ headers: webRequest.headers })
    )

    return yield* session
      ? Effect.succeed({ id: session.user.id })
      : new AuthenticationRequiredError({
          message: "Authentication is required.",
        })
  })

export const BetterAuthLive = Layer.effect(
  BetterAuth,
  Effect.gen(function* () {
    const env = yield* Env
    const database = yield* Database
    const authSecret = Redacted.value(env.auth.secret)
    const resendApiKey = Redacted.value(env.auth.email.resendApiKey)
    const mailer = createResendAuthMailer({
      apiKey: resendApiKey,
      from: env.auth.email.from,
    })
    const db = database.withClient((client) => client)

    return initAuth({
      appName: "Kaiser",
      baseURL: env.auth.url,
      secret: authSecret,
      trustedOrigins: [env.app.url],
      db,
      logger: {
        info: console.info,
        warn: console.warn,
        error: console.error,
      },
      mailer,
      useSecureCookies: env.server.env === "prod",
    })
  })
)

export const ExternalListOAuthConfigLive = Layer.effect(
  ExternalListOAuthConfig,
  Effect.gen(function* () {
    const env = yield* Env
    return {
      mal: providerConfig(
        env.externalList.mal,
        env.auth.url,
        env.app.url,
        "mal"
      ),
      aniList: providerConfig(
        env.externalList.aniList,
        env.auth.url,
        env.app.url,
        "anilist"
      ),
    }
  })
)
