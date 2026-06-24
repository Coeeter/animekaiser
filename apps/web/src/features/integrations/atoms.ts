import { KaiserAtomRpc } from "../../lib/rpc-client"

export const accountHealthAtom = KaiserAtomRpc.query(
  "ListExternalListAccounts",
  void 0
)
