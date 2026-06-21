import * as Context from "effect/Context"

export class RpcServerConfig extends Context.Tag(
  "@workspace/rpc/RpcServerConfig"
)<
  RpcServerConfig,
  { readonly appUrl: string; readonly mediaPublicUrl: string }
>() {}
