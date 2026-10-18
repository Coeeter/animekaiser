import {
  type ExternalListAccountError,
  ExternalListAccountsService,
} from "@animekaiser/core"
import type { AuthenticationRequiredError } from "@animekaiser/domain"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { BetterAuth, requireCurrentUser } from "../auth"
import { Env } from "../env"

class ExternalListRouteError extends Data.TaggedError(
  "ExternalListRouteError"
)<{
  status: 400 | 503
  message: string
}> {}

const errorResponse = (error: { readonly message: string }, status: number) =>
  Effect.succeed(HttpServerResponse.text(error.message, { status }))

const handleExternalListError = Effect.catchTags({
  AuthenticationRequiredError: (error: AuthenticationRequiredError) =>
    errorResponse(error, 401),
  ExternalListRouteError: (error: ExternalListRouteError) =>
    errorResponse(error, error.status),
  ExternalListAccountError: (error: ExternalListAccountError) =>
    errorResponse(error, error.status),
})

const invalidRequest = (message: string) =>
  new ExternalListRouteError({ status: 400, message })

const ProviderParams = Schema.Struct({
  provider: Schema.Literals(["mal", "anilist"]),
})

const requireProvider = HttpRouter.schemaPathParams(ProviderParams).pipe(
  Effect.map(({ provider }) => provider),
  Effect.mapError(() => invalidRequest("Unsupported external list provider"))
)

const CallbackParams = Schema.Struct({
  code: Schema.NonEmptyString,
  state: Schema.NonEmptyString,
})

const LinkParams = Schema.Struct({
  callbackURL: Schema.optional(Schema.String),
})

export const safeCallbackUrl = (value: string, appURL: string) => {
  if (!URL.canParse(value, appURL)) return null
  const callbackURL = new URL(value, appURL)
  return callbackURL.origin === new URL(appURL).origin
    ? callbackURL.toString()
    : null
}

export const ExternalListAccountsRoutesLive = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const accounts = yield* ExternalListAccountsService
    const auth = yield* BetterAuth
    const env = yield* Env

    const linkHandler = Effect.gen(function* () {
      const provider = yield* requireProvider
      const user = yield* requireCurrentUser(auth)
      const { callbackURL } = yield* HttpServerRequest.schemaSearchParams(
        LinkParams
      ).pipe(Effect.mapError(() => invalidRequest("Invalid callbackURL")))
      const safeURL = yield* Effect.fromOption(
        Option.fromNullishOr(
          safeCallbackUrl(callbackURL ?? env.app.url, env.app.url)
        ),
        () => invalidRequest("Invalid callbackURL")
      )
      const url = yield* accounts.createLinkUrl(provider, {
        userId: user.id,
        callbackURL: safeURL,
      })
      return HttpServerResponse.redirect(url)
    }).pipe(handleExternalListError)

    const callbackHandler = Effect.gen(function* () {
      const provider = yield* requireProvider
      const { code, state } = yield* HttpServerRequest.schemaSearchParams(
        CallbackParams
      ).pipe(Effect.mapError(() => invalidRequest("Missing code or state")))
      const user = yield* requireCurrentUser(auth)
      const callbackURL = yield* accounts.handleCallback(provider, {
        userId: user.id,
        code,
        state,
      })
      return HttpServerResponse.redirect(callbackURL)
    }).pipe(handleExternalListError)

    yield* router.add("GET", "/api/link/:provider", linkHandler)
    yield* router.add("GET", "/api/link/:provider/callback", callbackHandler)
  })
).pipe(Layer.provide(ExternalListAccountsService.layer))
