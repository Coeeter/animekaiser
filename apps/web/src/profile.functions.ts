import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { KaiserRpcClient } from "@workspace/domain"
import * as Effect from "effect/Effect"
import { makeRpcProtocol } from "./rpc"

const requestCookie = () => getRequestHeaders().get("cookie") ?? ""

export const getOwnProfile = createServerFn({ method: "GET" }).handler(() =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const client = yield* KaiserRpcClient
        return yield* client.GetOwnProfile()
      }).pipe(Effect.provide(makeRpcProtocol(requestCookie())))
    )
  )
)

export const getPublicProfile = createServerFn({ method: "GET" })
  .validator((input: { username: string }) => input)
  .handler(({ data }) =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const client = yield* KaiserRpcClient
          return yield* client.GetPublicProfile({ username: data.username })
        }).pipe(Effect.provide(makeRpcProtocol(requestCookie())))
      )
    )
  )
