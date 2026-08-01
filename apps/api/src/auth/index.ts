import type { KaiserAuth } from "@animekaiser/auth/server"
import { AuthServer, initAuth } from "@animekaiser/auth/server"
import { ExternalListOAuthConfig } from "@animekaiser/core"
import { Database } from "@animekaiser/db"
import { AuthenticationRequiredError } from "@animekaiser/domain"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import { Env } from "../env"
import { createResendAuthMailer } from "./mailer"

type BetterAuthRuntime = KaiserAuth
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

export { AuthServer as BetterAuth }

export const getCurrentSession = Effect.fn("getCurrentSession")(function* (
  auth: BetterAuthRuntime
) {
  const request = yield* HttpServerRequest.HttpServerRequest
  const webRequest = yield* HttpServerRequest.toWeb(request).pipe(
    Effect.mapError(
      () =>
        new AuthenticationRequiredError({
          message: "Authentication request could not be read.",
        })
    )
  )
  return yield* Effect.promise(() =>
    auth.api.getSession({ headers: webRequest.headers })
  )
})

export const requireCurrentUser = Effect.fn("requireCurrentUser")(function* (
  auth: BetterAuthRuntime
) {
  const session = yield* getCurrentSession(auth)
  return yield* session
    ? Effect.succeed({ id: session.user.id })
    : new AuthenticationRequiredError({
        message: "Authentication is required.",
      })
})

export const BetterAuthLive = Layer.effect(
  AuthServer,
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
      appURL: env.app.url,
      baseURL: env.auth.url,
      cookieDomain: env.auth.cookieDomain || undefined,
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
      checkPwnedPasswords: env.server.env === "prod",
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
