import { ExternalListAccountsService } from "@workspace/core"
import {
  CurrentUser,
  ExternalListOperationError,
  IntegrationRpcs,
} from "@workspace/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export const IntegrationHandlersLive = IntegrationRpcs.toLayer(
  IntegrationRpcs.of({
    ListExternalListAccounts: () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        return yield* ExternalListAccountsService.listAccounts(user.id).pipe(
          Effect.catchTag("ExternalListAccountError", (error) =>
            Effect.fail(
              new ExternalListOperationError({ message: error.message })
            )
          )
        )
      }),
    CreateExternalListLink: ({ provider, callbackURL }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const url = yield* ExternalListAccountsService.createLinkUrl(provider, {
          userId: user.id,
          callbackURL,
        }).pipe(
          Effect.catchTag("ExternalListAccountError", (error) =>
            Effect.fail(
              new ExternalListOperationError({ message: error.message })
            )
          )
        )
        return { url }
      }),
    DisconnectExternalListAccount: ({ provider }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        yield* ExternalListAccountsService.disconnectAccount(
          user.id,
          provider
        ).pipe(
          Effect.catchTag("ExternalListAccountError", (error) =>
            Effect.fail(
              new ExternalListOperationError({ message: error.message })
            )
          )
        )
      }),
  })
).pipe(Layer.provide(ExternalListAccountsService.Default))
