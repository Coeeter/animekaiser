import type { DatabaseService } from "@workspace/db"
import { externalListAccount } from "@workspace/db"
import { and, eq, lte } from "drizzle-orm"
import * as Effect from "effect/Effect"
import type { ExternalListProvider, ProviderOAuthConfig } from "./oauth"
import {
  ExternalListOAuthError,
  exchangeAniListAuthorizationCode,
  exchangeMalAuthorizationCode,
  fetchAniListUser,
  fetchMalUser,
  malScopes,
  refreshAniListAccessToken,
  refreshMalAccessToken,
  takeState,
} from "./oauth"

type LinkedExternalListAccount = {
  userId: string
  provider: ExternalListProvider
  providerAccountId: string
  accessToken: string
  refreshToken?: string
  accessTokenExpiresAt?: Date
  refreshTokenExpiresAt?: Date
  scopes?: string
  tokenType?: string
}

type RefreshExternalListTokenConfig = {
  mal: Pick<ProviderOAuthConfig, "clientId" | "clientSecret">
  aniList: Pick<ProviderOAuthConfig, "clientId" | "clientSecret">
}

type RefreshExternalListTokenParams = {
  accountId: string
  provider: ExternalListProvider
  refreshToken: string
  currentAccessTokenExpiresAt?: Date | null
  currentNextTokenRefreshAt?: Date | null
}

const getNextTokenRefreshAt = (expiresAt?: Date) =>
  expiresAt
    ? new Date(Math.max(Date.now(), expiresAt.getTime() - 10 * 60 * 1000))
    : undefined

const linkExternalListAccount = (
  database: DatabaseService,
  linkedAccount: LinkedExternalListAccount
) =>
  Effect.gen(function* () {
    const now = new Date()
    const linkedRows = yield* database.execute((db) =>
      db
        .select({
          id: externalListAccount.id,
          userId: externalListAccount.userId,
        })
        .from(externalListAccount)
        .where(
          and(
            eq(externalListAccount.provider, linkedAccount.provider),
            eq(
              externalListAccount.providerAccountId,
              linkedAccount.providerAccountId
            )
          )
        )
    )
    const linkedToAnotherUser = linkedRows.some(
      (row) => row.userId !== linkedAccount.userId
    )
    if (linkedToAnotherUser) {
      return yield* new ExternalListOAuthError({
        provider: linkedAccount.provider,
        message: `${linkedAccount.provider} account is already linked to a different user`,
      })
    }

    const existing = yield* database.execute((db) =>
      db
        .select({ id: externalListAccount.id })
        .from(externalListAccount)
        .where(
          and(
            eq(externalListAccount.provider, linkedAccount.provider),
            eq(externalListAccount.userId, linkedAccount.userId)
          )
        )
        .limit(1)
    )

    const nextTokenRefreshAt = getNextTokenRefreshAt(
      linkedAccount.accessTokenExpiresAt
    )

    if (existing[0]) {
      yield* database.execute((db) =>
        db
          .update(externalListAccount)
          .set({
            providerAccountId: linkedAccount.providerAccountId,
            accessToken: linkedAccount.accessToken,
            refreshToken: linkedAccount.refreshToken,
            accessTokenExpiresAt: linkedAccount.accessTokenExpiresAt,
            refreshTokenExpiresAt: linkedAccount.refreshTokenExpiresAt,
            scopes: linkedAccount.scopes,
            tokenType: linkedAccount.tokenType,
            nextTokenRefreshAt,
            updatedAt: now,
          })
          .where(eq(externalListAccount.id, existing[0].id))
      )
      return
    }

    yield* database.execute((db) =>
      db.insert(externalListAccount).values({
        id: crypto.randomUUID(),
        provider: linkedAccount.provider,
        providerAccountId: linkedAccount.providerAccountId,
        userId: linkedAccount.userId,
        accessToken: linkedAccount.accessToken,
        refreshToken: linkedAccount.refreshToken,
        accessTokenExpiresAt: linkedAccount.accessTokenExpiresAt,
        refreshTokenExpiresAt: linkedAccount.refreshTokenExpiresAt,
        scopes: linkedAccount.scopes,
        tokenType: linkedAccount.tokenType,
        nextTokenRefreshAt,
        createdAt: now,
        updatedAt: now,
      })
    )
  }).pipe(
    Effect.mapError(
      (cause) =>
        new ExternalListOAuthError({
          provider: linkedAccount.provider,
          message: "[External List] Failed to link external list account.",
          cause,
        })
    )
  )

export const handleMalCallback = (
  database: DatabaseService,
  config: ProviderOAuthConfig,
  params: {
    userId: string
    code: string
    state: string
  }
) =>
  Effect.gen(function* () {
    const state = yield* takeState(params.state)
    if (state.userId !== params.userId) {
      return yield* new ExternalListOAuthError({
        provider: "mal",
        message:
          "[External List] MAL OAuth state does not match the current session.",
        cause: { stateUserId: state.userId, userId: params.userId },
      })
    }
    if (!state.codeVerifier) {
      return yield* new ExternalListOAuthError({
        provider: "mal",
        message:
          "[External List] MAL OAuth state did not include a code verifier.",
        cause: state,
      })
    }

    const tokens = yield* exchangeMalAuthorizationCode(config, {
      code: params.code,
      codeVerifier: state.codeVerifier,
    })
    const malUser = yield* fetchMalUser(tokens.access_token)

    yield* linkExternalListAccount(database, {
      userId: params.userId,
      provider: "mal",
      providerAccountId: String(malUser.id),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined,
      scopes: tokens.scope ?? malScopes.join(" "),
      tokenType: tokens.token_type,
    })

    return state.callbackURL
  })

export const handleAniListCallback = (
  database: DatabaseService,
  config: ProviderOAuthConfig,
  params: {
    userId: string
    code: string
    state: string
  }
) =>
  Effect.gen(function* () {
    const state = yield* takeState(params.state)
    if (state.userId !== params.userId) {
      return yield* new ExternalListOAuthError({
        provider: "anilist",
        message:
          "[External List] AniList OAuth state does not match the current session.",
        cause: { stateUserId: state.userId, userId: params.userId },
      })
    }

    const tokens = yield* exchangeAniListAuthorizationCode(config, {
      code: params.code,
    })
    const aniListUser = yield* fetchAniListUser(tokens.access_token)

    yield* linkExternalListAccount(database, {
      userId: params.userId,
      provider: "anilist",
      providerAccountId: String(aniListUser.id),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined,
      tokenType: tokens.token_type,
    })

    return state.callbackURL
  })

export const refreshExternalListAccountToken = (
  database: DatabaseService,
  config: RefreshExternalListTokenConfig,
  params: RefreshExternalListTokenParams
) =>
  Effect.gen(function* () {
    const { scopes, tokens } =
      params.provider === "mal"
        ? yield* refreshMalAccessToken(config.mal, params.refreshToken).pipe(
            Effect.map((tokenResponse) => ({
              scopes: tokenResponse.scope,
              tokens: tokenResponse,
            }))
          )
        : yield* refreshAniListAccessToken(
            config.aniList,
            params.refreshToken
          ).pipe(
            Effect.map((tokenResponse) => ({
              scopes: undefined,
              tokens: tokenResponse,
            }))
          )
    const now = new Date()
    const accessTokenExpiresAt = tokens.expires_in
      ? new Date(now.getTime() + tokens.expires_in * 1000)
      : params.currentAccessTokenExpiresAt
    const nextTokenRefreshAt =
      getNextTokenRefreshAt(accessTokenExpiresAt ?? undefined) ??
      params.currentNextTokenRefreshAt

    yield* database
      .execute((db) =>
        db
          .update(externalListAccount)
          .set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? params.refreshToken,
            accessTokenExpiresAt,
            scopes,
            tokenType: tokens.token_type,
            lastTokenRefreshAt: now,
            nextTokenRefreshAt,
            updatedAt: now,
          })
          .where(eq(externalListAccount.id, params.accountId))
      )
      .pipe(
        Effect.mapError(
          (cause) =>
            new ExternalListOAuthError({
              provider: params.provider,
              message: "[External List] Failed to persist refreshed token.",
              cause,
            })
        )
      )
  })

export const findExternalListAccountsDueForTokenRefresh = (
  database: DatabaseService,
  now = new Date()
) =>
  database
    .execute((db) =>
      db
        .select()
        .from(externalListAccount)
        .where(lte(externalListAccount.nextTokenRefreshAt, now))
    )
    .pipe(
      Effect.mapError(
        (cause) =>
          new ExternalListOAuthError({
            message:
              "[External List] Failed to load accounts due for token refresh.",
            cause,
          })
      )
    )
