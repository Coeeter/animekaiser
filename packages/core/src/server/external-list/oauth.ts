import { HttpBody, HttpClient, HttpClientRequest } from "@effect/platform"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"

const malAuthorizeUrl = "https://myanimelist.net/v1/oauth2/authorize"
const malTokenUrl = "https://myanimelist.net/v1/oauth2/token"
const malUserInfoUrl = "https://api.myanimelist.net/v2/users/@me"
const aniListAuthorizeUrl = "https://anilist.co/api/v2/oauth/authorize"
const aniListTokenUrl = "https://anilist.co/api/v2/oauth/token"
const aniListGraphqlUrl = "https://graphql.anilist.co"

export const malScopes = ["read:users", "read:users:lists", "write:users:lists"]

export type ExternalListProvider = "mal" | "anilist"

export type ProviderOAuthConfig = {
  clientId: string
  clientSecret: string
  redirectURI: string
  callbackBaseURL: string
}

export type MalTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type: string
  scope?: string
}

export type AniListTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type: string
}

export type ExternalListUserResponse = {
  id: number
  name?: string
}

export type ExternalListOAuthState = {
  callbackURL: string
  codeVerifier?: string
  userId: string
}

export class ExternalListOAuthStateStore extends Context.Tag(
  "@workspace/core/server/ExternalListOAuthStateStore"
)<
  ExternalListOAuthStateStore,
  {
    create: (state: ExternalListOAuthState) => Effect.Effect<string, unknown>
    take: (id: string) => Effect.Effect<ExternalListOAuthState | undefined, unknown>
  }
>() {}

export class ExternalListOAuthError extends Data.TaggedError(
  "ExternalListOAuthError"
)<{
  provider?: ExternalListProvider
  message: string
  cause?: unknown
}> {}

const base64UrlEncode = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("base64url")

const randomString = (length: number) => {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes).slice(0, length)
}

const createState = (state: ExternalListOAuthState) =>
  Effect.gen(function* () {
    const store = yield* ExternalListOAuthStateStore
    return yield* store.create(state).pipe(
      Effect.mapError(
        (cause) =>
          new ExternalListOAuthError({
            message: "[External List] Unable to store OAuth state.",
            cause,
          })
      )
    )
  })

export const takeState = (value: string) =>
  Effect.gen(function* () {
    const store = yield* ExternalListOAuthStateStore
    const state = yield* store.take(value).pipe(
      Effect.mapError(
        (cause) =>
          new ExternalListOAuthError({
            message: "[External List] Unable to load OAuth state.",
            cause,
          })
      )
    )
    return yield* state
      ? Effect.succeed(state)
      : new ExternalListOAuthError({
          message: "[External List] Invalid or expired OAuth state.",
        })
  })

const normalizeCallbackURL = (value: string, baseURL: string) => {
  const base = new URL(baseURL)
  const callbackURL = new URL(value, base)
  return callbackURL.origin === base.origin
    ? callbackURL.toString()
    : base.toString()
}

const createExternalListAuthorizationUrl = (
  config: ProviderOAuthConfig,
  params: {
    authorizeUrl: string
    state: string
    codeChallenge?: string
    scopes?: ReadonlyArray<string>
  }
) => {
  const url = new URL(params.authorizeUrl)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectURI)
  url.searchParams.set("state", params.state)
  if (params.codeChallenge) {
    url.searchParams.set("code_challenge", params.codeChallenge)
    url.searchParams.set("code_challenge_method", "plain")
  }
  if (params.scopes) {
    url.searchParams.set("scope", params.scopes.join(" "))
  }

  return url
}

const requestJson = (
  request: HttpClientRequest.HttpClientRequest,
  options: {
    provider: ExternalListProvider
    message: string
  }
) =>
  Effect.gen(function* () {
    const response = yield* HttpClient.execute(request)
    if (response.status < 200 || response.status >= 300) {
      return yield* new ExternalListOAuthError({
        provider: options.provider,
        message: options.message,
        cause: { status: response.status },
      })
    }
    return yield* response.json
  }).pipe(
    Effect.mapError(
      (cause) =>
        new ExternalListOAuthError({
          provider: options.provider,
          message: options.message,
          cause,
        })
    )
  )

export const createMalLinkUrl = (
  config: ProviderOAuthConfig,
  params: {
    userId: string
    callbackURL: string
  }
) =>
  Effect.gen(function* () {
    const codeVerifier = randomString(128)
    const state = yield* createState({
      callbackURL: normalizeCallbackURL(params.callbackURL, config.callbackBaseURL),
      codeVerifier,
      userId: params.userId,
    })

    return createExternalListAuthorizationUrl(config, {
      authorizeUrl: malAuthorizeUrl,
      state,
      codeChallenge: codeVerifier,
      scopes: malScopes,
    }).toString()
  })

export const createAniListLinkUrl = (
  config: ProviderOAuthConfig,
  params: {
    userId: string
    callbackURL: string
  }
) =>
  Effect.gen(function* () {
    const state = yield* createState({
      callbackURL: normalizeCallbackURL(params.callbackURL, config.callbackBaseURL),
      userId: params.userId,
    })
    return createExternalListAuthorizationUrl(config, {
      authorizeUrl: aniListAuthorizeUrl,
      state,
    }).toString()
  })

export const exchangeMalAuthorizationCode = (
  config: ProviderOAuthConfig,
  params: {
    code: string
    codeVerifier: string
  }
) =>
  Effect.gen(function* () {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: params.code,
      code_verifier: params.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: config.redirectURI,
    })
    const tokens = (yield* requestJson(
      HttpClientRequest.post(malTokenUrl, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: HttpBody.text(
          body.toString(),
          "application/x-www-form-urlencoded"
        ),
      }),
      {
        provider: "mal",
        message: "[External List] Failed to exchange MAL authorization code.",
      }
    )) as Partial<MalTokenResponse>

    if (!tokens.access_token) {
      return yield* new ExternalListOAuthError({
        provider: "mal",
        message:
          "[External List] MAL token response did not include an access token.",
        cause: tokens,
      })
    }

    return tokens as MalTokenResponse
  })

export const fetchMalUser = (accessToken: string) =>
  Effect.gen(function* () {
    const user = (yield* requestJson(
      HttpClientRequest.get(`${malUserInfoUrl}?fields=id,name`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }),
      {
        provider: "mal",
        message: "[External List] Failed to fetch MAL user.",
      }
    )) as Partial<ExternalListUserResponse>

    if (!user.id) {
      return yield* new ExternalListOAuthError({
        provider: "mal",
        message: "[External List] MAL user response did not include an id.",
        cause: user,
      })
    }

    return user as ExternalListUserResponse
  })

export const exchangeAniListAuthorizationCode = (
  config: ProviderOAuthConfig,
  params: {
    code: string
  }
) =>
  Effect.gen(function* () {
    const tokens = (yield* requestJson(
      HttpClientRequest.post(aniListTokenUrl, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: HttpBody.unsafeJson({
          grant_type: "authorization_code",
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectURI,
          code: params.code,
        }),
      }),
      {
        provider: "anilist",
        message:
          "[External List] Failed to exchange AniList authorization code.",
      }
    )) as Partial<AniListTokenResponse>

    if (!tokens.access_token) {
      return yield* new ExternalListOAuthError({
        provider: "anilist",
        message:
          "[External List] AniList token response did not include an access token.",
        cause: tokens,
      })
    }

    return tokens as AniListTokenResponse
  })

export const fetchAniListUser = (accessToken: string) =>
  Effect.gen(function* () {
    const body = (yield* requestJson(
      HttpClientRequest.post(aniListGraphqlUrl, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: HttpBody.unsafeJson({
          query: "query Viewer { Viewer { id name } }",
        }),
      }),
      {
        provider: "anilist",
        message: "[External List] Failed to fetch AniList user.",
      }
    )) as {
      data?: { Viewer?: Partial<ExternalListUserResponse> }
    }
    const user = body.data?.Viewer

    if (!user?.id) {
      return yield* new ExternalListOAuthError({
        provider: "anilist",
        message: "[External List] AniList user response did not include an id.",
        cause: body,
      })
    }

    return user as ExternalListUserResponse
  })

export const refreshMalAccessToken = (
  config: Pick<ProviderOAuthConfig, "clientId" | "clientSecret">,
  refreshToken: string
) =>
  Effect.gen(function* () {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
    return (yield* requestJson(
      HttpClientRequest.post(malTokenUrl, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: HttpBody.text(
          body.toString(),
          "application/x-www-form-urlencoded"
        ),
      }),
      {
        provider: "mal",
        message: "[External List] Failed to refresh MAL access token.",
      }
    )) as MalTokenResponse
  })

export const refreshAniListAccessToken = (
  config: Pick<ProviderOAuthConfig, "clientId" | "clientSecret">,
  refreshToken: string
) =>
  Effect.gen(function* () {
    return (yield* requestJson(
      HttpClientRequest.post(aniListTokenUrl, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: HttpBody.unsafeJson({
          grant_type: "refresh_token",
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: refreshToken,
        }),
      }),
      {
        provider: "anilist",
        message: "[External List] Failed to refresh AniList access token.",
      }
    )) as AniListTokenResponse
  })
