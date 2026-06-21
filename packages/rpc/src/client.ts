import { RpcClient } from "@effect/rpc"
import { KaiserRpcs } from "@workspace/domain"

export const KaiserRpcClient = RpcClient.make(KaiserRpcs)
