import { Database } from "@animekaiser/db"
import { sql } from "drizzle-orm"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"

export const ROOM_EVENTS_CHANNEL = "room_events"

const everyRoom = "*"

// Postgres delivers NOTIFY only after the surrounding transaction commits, so
// issuing it inside the state change cannot announce uncommitted state or be
// lost between commit and a separate publish.
export const notifyRoom = (roomId: string) =>
  sql`select pg_notify(${ROOM_EVENTS_CHANNEL}, ${roomId})`

export class RoomEvents extends Context.Service<RoomEvents>()(
  "@animekaiser/core/RoomEvents",
  {
    make: Effect.gen(function* () {
      const database = yield* Database
      const hub = yield* PubSub.sliding<string>(1024)

      const listen = Effect.scoped(
        Effect.gen(function* () {
          const notifications = yield* database.listen(ROOM_EVENTS_CHANNEL)
          // Anything missed while LISTEN was down is reconciled by reloading.
          yield* PubSub.publish(hub, everyRoom)
          return yield* Stream.fromQueue(notifications).pipe(
            Stream.runForEach((roomId) => PubSub.publish(hub, roomId))
          )
        })
      )

      yield* listen.pipe(
        Effect.tapCause((cause) =>
          Effect.logWarning("[Rooms] LISTEN failed; reconnecting", cause)
        ),
        Effect.retry(Schedule.spaced("2 seconds")),
        Effect.forkScoped
      )

      const subscribe = (roomId: string) =>
        PubSub.subscribe(hub).pipe(
          Effect.map((subscription) =>
            Stream.fromSubscription(subscription).pipe(
              Stream.filter(
                (payload) => payload === roomId || payload === everyRoom
              ),
              Stream.as(undefined)
            )
          )
        )

      return { subscribe }
    }),
  }
) {
  static readonly layer = Layer.effect(RoomEvents, RoomEvents.make)
}
