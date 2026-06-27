import { KaiserRpcClient } from "@workspace/rpc/client"
import * as Effect from "effect/Effect"
import { runRpc } from "../../lib/rpc-client"

export type StreamEpisodesInput = Parameters<
  Effect.Effect.Success<typeof KaiserRpcClient>["ListStreamEpisodes"]
>[0]

export type StreamPlaybackInput = Parameters<
  Effect.Effect.Success<typeof KaiserRpcClient>["GetStreamPlayback"]
>[0]

export const loadStreamEpisodes = (input: StreamEpisodesInput) =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.ListStreamEpisodes(input)
    })
  )

export const loadStreamPlayback = (input: StreamPlaybackInput) =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.GetStreamPlayback(input)
    })
  )
