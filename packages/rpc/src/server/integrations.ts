import { ExternalListAccountsService } from "@workspace/core/server"
import {
  ExternalListOperationError,
  IntegrationRpcs,
} from "@workspace/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { RpcSession } from "./session"

const mapError = (error: { message: string }) =>
  new ExternalListOperationError({ message: error.message })

export const IntegrationHandlersLive = IntegrationRpcs.toLayer(
  Effect.gen(function* () {
    const sessions = yield* RpcSession
    return IntegrationRpcs.of({
      ListExternalListAccounts: (_, options) =>
        Effect.gen(function* () {
          const user = yield* sessions.requireUser(options.headers)
          return yield* ExternalListAccountsService.listAccounts(user.id)
        }).pipe(Effect.catchTag("ExternalListAccountError", (error) => Effect.fail(mapError(error)))),
      CreateExternalListLink: ({ provider, callbackURL }, options) =>
        Effect.gen(function* () {
          const user = yield* sessions.requireUser(options.headers)
          const url = yield* ExternalListAccountsService.createLinkUrl(provider, {
            userId: user.id,
            callbackURL,
          })
          return { url }
        }).pipe(Effect.catchTag("ExternalListAccountError", (error) => Effect.fail(mapError(error)))),
      DisconnectExternalListAccount: ({ provider }, options) =>
        Effect.gen(function* () {
          const user = yield* sessions.requireUser(options.headers)
          yield* ExternalListAccountsService.disconnectAccount(user.id, provider)
        }).pipe(Effect.catchTag("ExternalListAccountError", (error) => Effect.fail(mapError(error)))),
    })
  })
).pipe(Layer.provide(Layer.mergeAll(RpcSession.Default, ExternalListAccountsService.Default)))

