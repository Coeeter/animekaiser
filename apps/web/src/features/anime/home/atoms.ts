import { KaiserRpcClient } from "../../../services/api-clients"

export const homeAtom = KaiserRpcClient.query("GetAnimeHome", void 0)
export const randomAnimeAtom = KaiserRpcClient.query("GetRandomAnime", void 0, {
  timeToLive: 0,
})
