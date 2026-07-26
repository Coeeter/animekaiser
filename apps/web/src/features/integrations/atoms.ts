import {
  KaiserRpcClient,
  refreshOnAuthChange,
} from "../../services/api-clients"

export const accountHealthAtom = refreshOnAuthChange(
  KaiserRpcClient.query("ListExternalListAccounts", void 0, {
    reactivityKeys: ["integrations"],
  })
)

export const disconnectExternalAccountAtom = KaiserRpcClient.mutation(
  "DisconnectExternalListAccount"
)
