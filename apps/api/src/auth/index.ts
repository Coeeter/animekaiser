import type { AuthLogger, KaiserAuth } from "@animekaiser/auth/server"
import { AuthServer, initAuth } from "@animekaiser/auth/server"
import { ExternalListOAuthConfig } from "@animekaiser/core"
import { Database } from "@animekaiser/db"
import { AuthenticationRequiredError } from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import { Env } from "../env"
import { createResendAuthMailer } from "./mailer"

type BetterAuthRuntime = KaiserAuth
type EnvShape = Effect.Success<typeof Env>

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
  return yield* Effect.tryPromise({
    try: () => auth.api.getSession({ headers: webRequest.headers }),
    catch: () =>
      new AuthenticationRequiredError({
        message: "Authentication request could not be read.",
      }),
  })
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
    const db = database.client
    const context = yield* Effect.context<never>()
    const log =
      (write: (message: string) => Effect.Effect<void>): AuthLogger["info"] =>
      (message, meta) =>
        Effect.runForkWith(context)(
          write(message).pipe(Effect.annotateLogs(meta ?? {}))
        )

    return initAuth({
      appName: "Kaiser",
      appURL: env.app.url,
      baseURL: env.auth.url,
      cookieDomain: env.auth.cookieDomain || undefined,
      secret: authSecret,
      trustedOrigins: [env.app.url],
      db,
      logger: {
        info: log(Effect.logInfo),
        warn: log(Effect.logWarning),
        error: log(Effect.logError),
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
