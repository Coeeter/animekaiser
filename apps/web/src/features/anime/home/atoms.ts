import * as Effect from "effect/Effect"
import { KaiserRpcClient } from "../../../services/api-clients"

export const homeAtom = KaiserRpcClient.query("GetAnimeHome", void 0)
export const makeRandomAnimeAtom = () =>
  KaiserRpcClient.runtime.atom(
    Effect.flatMap(KaiserRpcClient, (client) =>
      client("GetRandomAnime", void 0)
    )
  )
