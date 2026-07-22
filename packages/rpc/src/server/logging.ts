import * as RpcMiddleware from "@effect/rpc/RpcMiddleware"
import * as Cause from "effect/Cause"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export class RpcRequestLogging extends RpcMiddleware.Tag<RpcRequestLogging>()(
  "@workspace/rpc/RpcRequestLogging",
  { wrap: true }
) {}

export const RpcRequestLoggingLive = Layer.succeed(
  RpcRequestLogging,
  RpcRequestLogging.of(({ clientId, next, rpc }) =>
    Effect.gen(function* () {
      const startedAt = yield* Clock.currentTimeMillis

      const fields = (status: "ok" | "error") =>
        Clock.currentTimeMillis.pipe(
          Effect.map((endedAt) => ({
            clientId,
            durationMs: endedAt - startedAt,
            rpc: rpc._tag,
            status,
          }))
        )

      return yield* next.pipe(
        Effect.tap(() =>
          fields("ok").pipe(
            Effect.flatMap((annotations) =>
              Effect.logInfo("rpc.request").pipe(
                Effect.annotateLogs(annotations)
              )
            )
          )
        ),
        Effect.tapErrorCause((cause) =>
          fields("error").pipe(
            Effect.flatMap((annotations) =>
              Effect.logError("rpc.request", {
                ...annotations,
                error: Cause.pretty(cause),
              })
            )
          )
        )
      )
    })
  )
)
