import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as HttpClient from "@effect/platform/HttpClient"
import { Database, externalListAccount, job } from "@workspace/db"
import { and, eq, sql } from "drizzle-orm"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import { LIBRARY_IMPORT_JOB_CHANNEL } from "../library/import"
import {
  findExternalListAccountsDueForTokenRefresh,
  handleAniListCallback,
  handleMalCallback,
  refreshExternalListAccountToken,
} from "./accounts"
import type { ExternalListProvider, ProviderOAuthConfig } from "./oauth"
import {
  createAniListLinkUrl,
  createMalLinkUrl,
  ExternalListOAuthStateStore,
} from "./oauth"

export class ExternalListOAuthConfig extends Context.Tag(
  "@workspace/core/ExternalListOAuthConfig"
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

export class ExternalListAccountsService extends Effect.Service<ExternalListAccountsService>()(
  "@workspace/core/ExternalListAccountsService",
  {
    accessors: true,
    dependencies: [FetchHttpClient.layer, ExternalListOAuthStateStore.Default],
    effect: Effect.gen(function* () {
      const database = yield* Database
      const config = yield* ExternalListOAuthConfig
      const http = yield* HttpClient.HttpClient
      const oauthStateStore = yield* ExternalListOAuthStateStore

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
          Effect.provideService(HttpClient.HttpClient, http),
          Effect.provideService(ExternalListOAuthStateStore, oauthStateStore),
          Effect.catchTag("ExternalListOAuthError", (error) =>
            Effect.fail(
              new ExternalListAccountError({
                status: 400,
                message: error.message,
                cause: error.cause,
              })
            )
          )
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
            ? handleMalCallback(database, providerConfig, params)
            : handleAniListCallback(database, providerConfig, params)
        ).pipe(
          Effect.provideService(HttpClient.HttpClient, http),
          Effect.provideService(ExternalListOAuthStateStore, oauthStateStore),
          Effect.catchTag("ExternalListOAuthError", (error) =>
            Effect.fail(
              new ExternalListAccountError({
                status: 400,
                message: error.message,
                cause: error.cause,
              })
            )
          )
        )
      })

      const listAccounts = Effect.fn(
        "ExternalListAccountsService.listAccounts"
      )(function* (userId: string) {
        const accounts = yield* database
          .execute((db) =>
            db
              .select({
                provider: externalListAccount.provider,
                expiresAt: externalListAccount.accessTokenExpiresAt,
                relinkRequiredAt: externalListAccount.relinkRequiredAt,
              })
              .from(externalListAccount)
              .where(eq(externalListAccount.userId, userId))
          )
          .pipe(
            Effect.catchTag("DatabaseError", (cause) =>
              Effect.fail(
                new ExternalListAccountError({
                  status: 503,
                  message: "Unable to load external list accounts.",
                  cause,
                })
              )
            )
          )

        return (["mal", "anilist"] as const).map((provider) => {
          const account = accounts.find((item) => item.provider === provider)
          const now = Date.now()
          const expiresAt = account?.expiresAt?.getTime() ?? null
          const state:
            | "disconnected"
            | "active"
            | "expiring"
            | "expired"
            | "relink_required" = !account
            ? "disconnected"
            : account.relinkRequiredAt
              ? "relink_required"
              : expiresAt !== null && expiresAt <= now
                ? "expired"
                : provider === "anilist" &&
                    expiresAt !== null &&
                    expiresAt <= now + 30 * 24 * 60 * 60 * 1000
                  ? "expiring"
                  : "active"
          return {
            provider,
            connected: Boolean(account),
            expiresAt: account?.expiresAt ?? null,
            state,
          }
        })
      })

      const disconnectAccount = Effect.fn(
        "ExternalListAccountsService.disconnectAccount"
      )(function* (userId: string, provider: ExternalListProvider) {
        yield* database
          .execute((db) =>
            db
              .delete(externalListAccount)
              .where(
                and(
                  eq(externalListAccount.userId, userId),
                  eq(externalListAccount.provider, provider)
                )
              )
          )
          .pipe(
            Effect.catchTag("DatabaseError", (cause) =>
              Effect.fail(
                new ExternalListAccountError({
                  status: 503,
                  message: "Unable to disconnect external list account.",
                  cause,
                })
              )
            )
          )
      })

      const startImport = Effect.fn("ExternalListAccountsService.startImport")(
        function* (userId: string, provider: ExternalListProvider) {
          const accounts = yield* database
            .execute((db) =>
              db
                .select({ id: externalListAccount.id })
                .from(externalListAccount)
                .where(
                  and(
                    eq(externalListAccount.userId, userId),
                    eq(externalListAccount.provider, provider)
                  )
                )
                .limit(1)
            )
            .pipe(
              Effect.catchTag("DatabaseError", (cause) =>
                Effect.fail(
                  new ExternalListAccountError({
                    status: 503,
                    message: "Unable to start library import.",
                    cause,
                  })
                )
              )
            )

          if (!accounts[0]) {
            return yield* new ExternalListAccountError({
              status: 400,
              message: "Connect this provider before importing.",
            })
          }

          const id = crypto.randomUUID()
          yield* database
            .execute((db) =>
              db.transaction(async (tx) => {
                await tx.insert(job).values({
                  id,
                  userId,
                  type: "library_import",
                  payload: { provider },
                })
                await tx.execute(
                  sql`select pg_notify(${LIBRARY_IMPORT_JOB_CHANNEL}, ${id})`
                )
              })
            )
            .pipe(
              Effect.catchTag("DatabaseError", (cause) =>
                Effect.fail(
                  new ExternalListAccountError({
                    status: 503,
                    message: "Unable to queue library import.",
                    cause,
                  })
                )
              )
            )

          return {
            id,
            provider,
            status: "pending" as const,
            result: null,
            errorMessage: null,
          }
        }
      )

      const refreshDueTokens = Effect.fn(
        "ExternalListAccountsService.refreshDueTokens"
      )(function* () {
        const dueAccounts = yield* findExternalListAccountsDueForTokenRefresh(
          database
        ).pipe(
          Effect.catchTag("ExternalListOAuthError", (error) =>
            Effect.fail(
              new ExternalListAccountError({
                status: 400,
                message: error.message,
                cause: error.cause,
              })
            )
          )
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

            return refreshExternalListAccountToken(database, config, {
              accountId: account.id,
              provider: "mal",
              refreshToken: account.refreshToken,
              currentAccessTokenExpiresAt: account.accessTokenExpiresAt,
              currentNextTokenRefreshAt: account.nextTokenRefreshAt,
            }).pipe(
              Effect.provideService(HttpClient.HttpClient, http),
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

      return {
        createLinkUrl,
        handleCallback,
        listAccounts,
        disconnectAccount,
        startImport,
        refreshDueTokens,
      }
    }),
  }
) {}

export const ExternalListTokenRefreshProgram =
  ExternalListAccountsService.refreshDueTokens
