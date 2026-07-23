import * as HttpLayerRouter from "@effect/platform/HttpLayerRouter"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import {
  ExternalListAccountError,
  ExternalListAccountsService,
} from "@workspace/core"
import { AuthenticationRequiredError } from "@workspace/domain"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import { BetterAuth, requireCurrentUser } from "../auth"
import { Env } from "../env"

class ExternalListRouteError extends Data.TaggedError(
  "ExternalListRouteError"
)<{
  status: 400 | 503
  message: string
}> {}

export const handleExternalListError = (
  error:
    | AuthenticationRequiredError
    | ExternalListRouteError
    | ExternalListAccountError
): Effect.Effect<HttpServerResponse.HttpServerResponse> => {
  if (error instanceof AuthenticationRequiredError) {
    return Effect.succeed(
      HttpServerResponse.text(error.message, { status: 401 })
    )
  }
  if (error instanceof ExternalListRouteError) {
    return Effect.succeed(
      HttpServerResponse.text(error.message, { status: error.status })
    )
  }
  if (error instanceof ExternalListAccountError) {
    return Effect.succeed(
      HttpServerResponse.text(error.message, { status: error.status })
    )
  }
  return Effect.succeed(
    HttpServerResponse.text("External list OAuth failed", { status: 500 })
  )
}

const getQueryParam = (
  request: HttpServerRequest.HttpServerRequest,
  key: string
) => new URL(request.url, "http://localhost").searchParams.get(key) ?? undefined

const requireQueryParam = (
  request: HttpServerRequest.HttpServerRequest,
  key: string
) => {
  const value = getQueryParam(request, key)
  return value
    ? Effect.succeed(value)
    : Effect.fail(
        new ExternalListRouteError({
          status: 400,
          message: `Missing ${key}`,
        })
      )
}

const requireProvider = Effect.gen(function* () {
  const { params } = yield* HttpRouter.RouteContext
  if (params.provider === "mal") return "mal" as const
  if (params.provider === "anilist") return "anilist" as const
  return yield* new ExternalListRouteError({
    status: 400,
    message: "Unsupported external list provider",
  })
})

export const safeCallbackUrl = (value: string, appURL: string) => {
  try {
    const callbackURL = new URL(value, appURL)
    return callbackURL.origin === new URL(appURL).origin
      ? callbackURL.toString()
      : null
  } catch {
    return null
  }
}

const getSafeCallbackURL = (
  request: HttpServerRequest.HttpServerRequest,
  appURL: string
) =>
  Effect.try({
    try: () => {
      const callbackURL = safeCallbackUrl(
        getQueryParam(request, "callbackURL") ?? appURL,
        appURL
      )
      if (!callbackURL) throw new Error()
      return callbackURL
    },
    catch: () =>
      new ExternalListRouteError({
        status: 400,
        message: "Invalid callbackURL",
      }),
  })

const linkHandler = Effect.gen(function* () {
  const provider = yield* requireProvider
  const request = yield* HttpServerRequest.HttpServerRequest
  const auth = yield* BetterAuth
  const user = yield* requireCurrentUser(auth)
  const env = yield* Env
  const callbackURL = yield* getSafeCallbackURL(request, env.app.url)
  const url = yield* ExternalListAccountsService.createLinkUrl(provider, {
    userId: user.id,
    callbackURL,
  })
  return HttpServerResponse.redirect(url)
}).pipe(
  Effect.catchAll(handleExternalListError),
  Effect.provide(ExternalListAccountsService.Default)
)

const callbackHandler = Effect.gen(function* () {
  const provider = yield* requireProvider
  const request = yield* HttpServerRequest.HttpServerRequest
  const code = yield* requireQueryParam(request, "code")
  const state = yield* requireQueryParam(request, "state")

  const auth = yield* BetterAuth
  const user = yield* requireCurrentUser(auth)
  const callbackURL = yield* ExternalListAccountsService.handleCallback(
    provider,
    { userId: user.id, code, state }
  )

  return HttpServerResponse.redirect(callbackURL)
}).pipe(
  Effect.catchAll(handleExternalListError),
  Effect.provide(ExternalListAccountsService.Default)
)

export const ExternalListAccountsRoutesLive = HttpLayerRouter.use((router) =>
  Effect.gen(function* () {
    yield* router.add("GET", "/api/link/:provider", linkHandler)
    yield* router.add("GET", "/api/link/:provider/callback", callbackHandler)
  })
)
