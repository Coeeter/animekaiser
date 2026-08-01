import { KaiserRpcClient } from "../../services/api-clients"

export const integrationsReactivityKeys = ["integrations"]

export const accountHealthAtom = KaiserRpcClient.query(
  "ListExternalListAccounts",
  void 0,
  {
    reactivityKeys: integrationsReactivityKeys,
  }
)

export const disconnectExternalAccountAtom = KaiserRpcClient.mutation(
  "DisconnectExternalListAccount"
)
