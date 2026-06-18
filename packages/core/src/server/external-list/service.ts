import { Database } from "@workspace/db"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import {
  findExternalListAccountsDueForTokenRefresh,
  handleAniListCallback,
  handleMalCallback,
  refreshExternalListAccountToken,
} from "./accounts"
import type {
  ExternalListOAuthError,
  ExternalListProvider,
  ProviderOAuthConfig,
} from "./oauth"
import { createAniListLinkUrl, createMalLinkUrl } from "./oauth"

export class ExternalListOAuthConfig extends Context.Tag(
  "@workspace/core/server/ExternalListOAuthConfig"
)<
  ExternalListOAuthConfig,
  {
    mal: ProviderOAuthConfig
    aniList: ProviderOAuthConfig
  }
>() {}

export class ExternalListAccountError extends Data.TaggedError(
  "ExternalListAccountError"
)<{
  status: 400 | 503
  message: string
  cause?: unknown
}> {}

export const mapExternalListOAuthError = (error: ExternalListOAuthError) =>
  new ExternalListAccountError({
    status: 400,
    message: error.message,
    cause: error.cause,
  })

export class ExternalListAccountsService extends Effect.Service<ExternalListAccountsService>()(
  "@workspace/core/server/ExternalListAccountsService",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const database = yield* Database
      const config = yield* ExternalListOAuthConfig
      const db = database.withClient((client) => client)

      const createLinkUrl = Effect.fn(
        "ExternalListAccountsService.createLinkUrl"
      )(function* (
        provider: ExternalListProvider,
        params: {
          userId: string
          callbackURL: string
        }
      ) {
        const providerConfig = provider === "mal" ? config.mal : config.aniList
        return yield* (
          provider === "mal"
            ? createMalLinkUrl(providerConfig, params)
            : createAniListLinkUrl(providerConfig, params)
        ).pipe(
          Effect.catchTag("ExternalListOAuthError", mapExternalListOAuthError)
        )
      })

      const handleCallback = Effect.fn(
        "ExternalListAccountsService.handleCallback"
      )(function* (
        provider: ExternalListProvider,
        params: {
          userId: string
          code: string
          state: string
        }
      ) {
        const providerConfig = provider === "mal" ? config.mal : config.aniList
        return yield* (
          provider === "mal"
            ? handleMalCallback(db, providerConfig, params)
            : handleAniListCallback(db, providerConfig, params)
        ).pipe(
          Effect.catchTag("ExternalListOAuthError", mapExternalListOAuthError)
        )
      })

      const refreshDueTokens = Effect.fn(
        "ExternalListAccountsService.refreshDueTokens"
      )(function* () {
        const dueAccounts = yield* findExternalListAccountsDueForTokenRefresh(
          db
        ).pipe(
          Effect.catchTag("ExternalListOAuthError", mapExternalListOAuthError)
        )

        if (dueAccounts.length === 0) return

        yield* Effect.logInfo(
          "[External List Token Refresh] Refreshing due tokens.",
          { count: dueAccounts.length }
        )

        yield* Effect.forEach(
          dueAccounts,
          (account) => {
            if (!account.refreshToken) {
              return Effect.logWarning(
                "[External List Token Refresh] Account is due but has no refresh token.",
                { accountId: account.id, provider: account.provider }
              )
            }

            return refreshExternalListAccountToken(db, config, {
              accountId: account.id,
              provider: account.provider,
              refreshToken: account.refreshToken,
              currentAccessTokenExpiresAt: account.accessTokenExpiresAt,
              currentNextTokenRefreshAt: account.nextTokenRefreshAt,
            }).pipe(
              Effect.tap(() =>
                Effect.logInfo(
                  "[External List Token Refresh] Token refreshed.",
                  { accountId: account.id, provider: account.provider }
                )
              ),
              Effect.catchAll((error) =>
                Effect.logError(
                  "[External List Token Refresh] Token refresh failed.",
                  { accountId: account.id, provider: account.provider, error }
                )
              )
            )
          },
          { concurrency: 4 }
        )
      })

      return { createLinkUrl, handleCallback, refreshDueTokens }
    }),
  }
) {}

export const ExternalListTokenRefreshProgram =
  ExternalListAccountsService.refreshDueTokens
