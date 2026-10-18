import { RoomService, roomGuestCookieName } from "@animekaiser/core"
import { GuestDisplayName, RoomId } from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as RateLimiter from "effect/persistence/RateLimiter"
import * as Schema from "effect/Schema"
import { Env } from "../env"

const GuestAdmission = Schema.Struct({
  inviteToken: Schema.NonEmptyString.check(Schema.isMaxLength(200)),
  displayName: GuestDisplayName,
})

const error = (status: number, message: string) =>
  HttpServerResponse.jsonUnsafe({ message }, { status })

const RoomParams = Schema.Struct({ roomId: RoomId })

export const RoomRoutesLive = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const env = yield* Env
    const rooms = yield* RoomService
    const appOrigin = new URL(env.app.url).origin
    // Per-address throttle kept in memory: the API runs as one instance, and
    // the limit only needs to stop scripted guest creation, not survive
    // restarts.
    const limiter = yield* RateLimiter.make
    const allowAdmission = (address: string) =>
      limiter
        .consume({
          key: `room-guest:${address}`,
          limit: 10,
          window: "10 minutes",
          algorithm: "fixed-window",
          onExceeded: "fail",
        })
        .pipe(Effect.isSuccess)

    const admitGuest = Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      if (request.headers.origin !== appOrigin)
        return error(403, "This request is not allowed.")
      const params = yield* HttpRouter.schemaPathParams(RoomParams).pipe(
        Effect.option
      )
      if (Option.isNone(params)) return error(404, "This room is unavailable.")
      const roomId = params.value.roomId
      const body = yield* HttpServerRequest.schemaBodyJson(GuestAdmission).pipe(
        Effect.option
      )
      if (Option.isNone(body))
        return error(400, "Enter a display name up to 32 characters.")
      const address =
        request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
        Option.getOrElse(request.remoteAddress, () => "unknown")
      if (!(yield* allowAdmission(address)))
        return error(429, "Too many guest joins. Try again in a few minutes.")
      return yield* rooms
        .admitGuest(roomId, body.value.inviteToken, body.value.displayName)
        .pipe(
          Effect.flatMap(({ token, expiresAt }) =>
            HttpServerResponse.empty({ status: 204 }).pipe(
              HttpServerResponse.setCookie(roomGuestCookieName(roomId), token, {
                httpOnly: true,
                secure: env.server.env === "prod",
                sameSite: "lax",
                path: "/",
                domain: env.auth.cookieDomain || undefined,
                expires: expiresAt,
              })
            )
          ),
          Effect.catchTag("RoomOperationError", (failure) =>
            Effect.succeed(
              error(
                failure.reason === "full" || failure.reason === "closed"
                  ? 409
                  : 403,
                failure.message
              )
            )
          )
        )
    })

    yield* router.add("POST", "/api/rooms/:roomId/guests", admitGuest)
  })
).pipe(Layer.provide(RateLimiter.layerStoreMemory))
