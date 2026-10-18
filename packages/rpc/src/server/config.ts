import * as Context from "effect/Context"

export class RpcServerConfig extends Context.Service<
  RpcServerConfig,
  { readonly appUrl: string; readonly mediaPublicUrl: string }
>()("@animekaiser/rpc/RpcServerConfig") {}
