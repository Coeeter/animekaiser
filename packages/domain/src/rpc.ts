import { Rpc, RpcClient, RpcGroup } from "@effect/rpc"
import * as Schema from "effect/Schema"

export class KaiserRpcs extends RpcGroup.make(
  Rpc.make("Ping", { success: Schema.Literal("pong") })
) {}

export const KaiserRpcClient = RpcClient.make(KaiserRpcs)
