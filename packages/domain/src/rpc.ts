import { RpcGroup } from "@effect/rpc"
import { AnimeRpcs } from "./anime/rpc"
import { AuthRpcs } from "./auth/rpc"
import { IntegrationRpcs } from "./integrations/rpc"
import { LibraryRpcs } from "./library/rpc"
import { ProfileRpcs } from "./profile/rpc"

export class KaiserRpcs extends RpcGroup.make().merge(
  AnimeRpcs,
  AuthRpcs,
  IntegrationRpcs,
  LibraryRpcs,
  ProfileRpcs
) {}
