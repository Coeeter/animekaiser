import { RpcGroup } from "effect/rpc"
import { AnimeRpcs } from "./anime/rpc"
import { AuthRpcs } from "./auth/rpc"
import { WatchHistoryRpcs } from "./history/rpc"
import { IntegrationRpcs } from "./integrations/rpc"
import { LibraryRpcs } from "./library/rpc"
import { ProfileRpcs } from "./profile/rpc"
import { RecommendationRpcs } from "./recommendations/rpc"
import { RoomRpcs } from "./rooms/rpc"
import { SocialRpcs } from "./social/rpc"
import { StreamingRpcs } from "./streaming/rpc"

export class KaiserRpcs extends RpcGroup.make().merge(
  AnimeRpcs,
  AuthRpcs,
  IntegrationRpcs,
  LibraryRpcs,
  ProfileRpcs,
  RecommendationRpcs,
  RoomRpcs,
  SocialRpcs,
  StreamingRpcs,
  WatchHistoryRpcs
) {}
