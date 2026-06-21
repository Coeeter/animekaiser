import { Rpc, RpcGroup } from "@effect/rpc"
import * as Schema from "effect/Schema"
import { AnimeRpcs } from "./anime"
import { IntegrationRpcs } from "./integrations"
import { LibraryRpcs } from "./library"
import { ProfileRpcs } from "./profile"

export const KaiserRpcs = RpcGroup.make(
  Rpc.make("Ping", { success: Schema.Literal("pong") })
).merge(ProfileRpcs, IntegrationRpcs, AnimeRpcs, LibraryRpcs)

export { AnimeRpcs, IntegrationRpcs, LibraryRpcs, ProfileRpcs }
