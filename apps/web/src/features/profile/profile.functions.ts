import { createServerFn } from "@tanstack/react-start"
import { KaiserRpcClient } from "@workspace/rpc/client"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { runServerRpc } from "../../lib/server-rpc"

export const getOwnProfile = createServerFn({ method: "GET" }).handler(() =>
  runServerRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.GetOwnProfile()
    })
  )
)

export const getPublicProfile = createServerFn({ method: "GET" })
  .validator(
    Schema.standardSchemaV1(Schema.Struct({ username: Schema.String }))
  )
  .handler(({ data }) =>
    runServerRpc(
      Effect.gen(function* () {
        const client = yield* KaiserRpcClient
        return yield* client.GetPublicProfile({ username: data.username })
      })
    )
  )
