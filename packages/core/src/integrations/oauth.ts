import * as HttpBody from "@effect/platform/HttpBody"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { KeyValueStore } from "../key-value-store"

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

const MalTokenResponse = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.optional(Schema.String),
  expires_in: Schema.optional(Schema.Number),
  token_type: Schema.String,
  scope: Schema.optional(Schema.String),
})
export type MalTokenResponse = typeof MalTokenResponse.Type

const AniListTokenResponse = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.optional(Schema.String),
  expires_in: Schema.optional(Schema.Number),
  token_type: Schema.String,
})
export type AniListTokenResponse = typeof AniListTokenResponse.Type

const ExternalListUserResponse = Schema.Struct({
  id: Schema.Number,
  name: Schema.optional(Schema.String),
})
export type ExternalListUserResponse = typeof ExternalListUserResponse.Type

const AniListViewerResponse = Schema.Struct({
  data: Schema.Struct({ Viewer: ExternalListUserResponse }),
})

export const ExternalListOAuthState = Schema.Struct({
  callbackURL: Schema.String,
  codeVerifier: Schema.optional(Schema.String),
  userId: Schema.String,
})
export type ExternalListOAuthState = typeof ExternalListOAuthState.Type

export class ExternalListOAuthStateStoreError extends Data.TaggedError(
  "ExternalListOAuthStateStoreError"
)<{ cause: unknown }> {}

export class ExternalListOAuthStateStore extends Effect.Service<ExternalListOAuthStateStore>()(
  "@workspace/core/ExternalListOAuthStateStore",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const storage = yield* KeyValueStore
      const key = (id: string) => `oauth-state:${id}`
      return {
        create: (state: ExternalListOAuthState) =>
          Effect.gen(function* () {
            const id = crypto.randomUUID()
            const value = yield* Schema.encode(
              Schema.parseJson(ExternalListOAuthState)
            )(state).pipe(
              Effect.mapError(
                (cause) => new ExternalListOAuthStateStoreError({ cause })
              )
            )
            yield* storage
              .set(key(id), value, 600)
              .pipe(
                Effect.mapError(
                  (cause) => new ExternalListOAuthStateStoreError({ cause })
                )
              )
            return id
          }),
        take: (id: string) =>
          storage.getDelete(key(id)).pipe(
            Effect.mapError(
              (cause) => new ExternalListOAuthStateStoreError({ cause })
            ),
            Effect.flatMap((value) =>
              value === null
                ? Effect.sync(
                    (): ExternalListOAuthState | undefined => undefined
                  )
                : Schema.decodeUnknown(
                    Schema.parseJson(ExternalListOAuthState)
                  )(value).pipe(
                    Effect.mapError(
                      (cause) => new ExternalListOAuthStateStoreError({ cause })
                    )
                  )
            )
          ),
      }
    }),
  }
) {}

export class ExternalListOAuthError extends Data.TaggedError(
  "ExternalListOAuthError"
)<{
  provider?: ExternalListProvider
  message: string
  cause?: unknown
}> {}

const randomString = (length: number) => {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  const base64 = Buffer.from(bytes).toString("base64url")
  return base64.slice(0, length)
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
      callbackURL: normalizeCallbackURL(
        params.callbackURL,
        config.callbackBaseURL
      ),
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
      callbackURL: normalizeCallbackURL(
        params.callbackURL,
        config.callbackBaseURL
      ),
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
    return yield* HttpClient.execute(
      HttpClientRequest.post(malTokenUrl, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: HttpBody.text(
          body.toString(),
          "application/x-www-form-urlencoded"
        ),
      })
    ).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(MalTokenResponse)),
      Effect.mapError(
        (cause) =>
          new ExternalListOAuthError({
            provider: "mal",
            message:
              "[External List] Failed to exchange MAL authorization code.",
            cause,
          })
      )
    )
  })

export const fetchMalUser = (accessToken: string) =>
  HttpClient.execute(
    HttpClientRequest.get(`${malUserInfoUrl}?fields=id,name`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    })
  ).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(ExternalListUserResponse)),
    Effect.mapError(
      (cause) =>
        new ExternalListOAuthError({
          provider: "mal",
          message: "[External List] Failed to fetch MAL user.",
          cause,
        })
    )
  )

export const exchangeAniListAuthorizationCode = (
  config: ProviderOAuthConfig,
  params: {
    code: string
  }
) =>
  HttpClient.execute(
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
    })
  ).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(AniListTokenResponse)),
    Effect.mapError(
      (cause) =>
        new ExternalListOAuthError({
          provider: "anilist",
          message:
            "[External List] Failed to exchange AniList authorization code.",
          cause,
        })
    )
  )

export const fetchAniListUser = (accessToken: string) =>
  Effect.gen(function* () {
    const body = yield* HttpClient.execute(
      HttpClientRequest.post(aniListGraphqlUrl, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: HttpBody.unsafeJson({
          query: "query Viewer { Viewer { id name } }",
        }),
      })
    ).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(AniListViewerResponse)),
      Effect.mapError(
        (cause) =>
          new ExternalListOAuthError({
            provider: "anilist",
            message: "[External List] Failed to fetch AniList user.",
            cause,
          })
      )
    )
    return body.data.Viewer
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
    return yield* HttpClient.execute(
      HttpClientRequest.post(malTokenUrl, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: HttpBody.text(
          body.toString(),
          "application/x-www-form-urlencoded"
        ),
      })
    ).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(MalTokenResponse)),
      Effect.mapError(
        (cause) =>
          new ExternalListOAuthError({
            provider: "mal",
            message: "[External List] Failed to refresh MAL access token.",
            cause,
          })
      )
    )
  })

export const refreshAniListAccessToken = (
  config: Pick<ProviderOAuthConfig, "clientId" | "clientSecret">,
  refreshToken: string
) =>
  HttpClient.execute(
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
    })
  ).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(AniListTokenResponse)),
    Effect.mapError(
      (cause) =>
        new ExternalListOAuthError({
          provider: "anilist",
          message: "[External List] Failed to refresh AniList access token.",
          cause,
        })
    )
  )
