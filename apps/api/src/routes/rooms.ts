import { RoomService, roomGuestCookieName } from "@animekaiser/core"
import { GuestDisplayName, RoomId } from "@animekaiser/domain"
import * as HttpLayerRouter from "@effect/platform/HttpLayerRouter"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Env } from "../env"

const GuestAdmission = Schema.Struct({
  inviteToken: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200)),
  displayName: GuestDisplayName,
})

const admissionWindowMs = 10 * 60 * 1000
const admissionsPerWindow = 10
const recentAdmissions = new Map<string, Array<number>>()

// Per-address throttle kept in memory: the API runs as one instance, and the
// limit only needs to stop scripted guest creation, not survive restarts.
const allowAdmission = (address: string, now: number) => {
  const recent = (recentAdmissions.get(address) ?? []).filter(
    (time) => time > now - admissionWindowMs
  )
  if (recent.length >= admissionsPerWindow) {
    recentAdmissions.set(address, recent)
    return false
  }
  recent.push(now)
  recentAdmissions.set(address, recent)
  if (recentAdmissions.size > 10_000) recentAdmissions.clear()
  return true
}

const error = (status: number, message: string) =>
  HttpServerResponse.unsafeJson({ message }, { status })

export const RoomRoutesLive = HttpLayerRouter.use((router) =>
  Effect.gen(function* () {
    const env = yield* Env
    const rooms = yield* RoomService
    const appOrigin = new URL(env.app.url).origin

    const admitGuest = Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      if (request.headers.origin !== appOrigin)
        return error(403, "This request is not allowed.")
      const { params } = yield* HttpRouter.RouteContext
      const roomId = Schema.decodeUnknownOption(RoomId)(params.roomId)
      if (roomId._tag === "None") return error(404, "This room is unavailable.")
      const body = yield* request.json.pipe(
        Effect.flatMap(Schema.decodeUnknown(GuestAdmission)),
        Effect.option
      )
      if (body._tag === "None")
        return error(400, "Enter a display name up to 32 characters.")
      const address =
        request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
        Option.getOrElse(request.remoteAddress, () => "unknown")
      if (!allowAdmission(address, Date.now()))
        return error(429, "Too many guest joins. Try again in a few minutes.")
      return yield* rooms
        .admitGuest(
          roomId.value,
          body.value.inviteToken,
          body.value.displayName
        )
        .pipe(
          Effect.flatMap(({ token, expiresAt }) =>
            HttpServerResponse.empty({ status: 204 }).pipe(
              HttpServerResponse.setCookie(
                roomGuestCookieName(roomId.value),
                token,
                {
                  httpOnly: true,
                  secure: env.server.env === "prod",
                  sameSite: "lax",
                  path: "/",
                  domain: env.auth.cookieDomain || undefined,
                  expires: expiresAt,
                }
              )
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
)
