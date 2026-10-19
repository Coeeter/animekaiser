import { Database, query } from "@animekaiser/db"
import { sql } from "drizzle-orm"
import * as Effect from "effect/Effect"
import * as PubSub from "effect/PubSub"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"

const everyKey = "*"

// Postgres delivers NOTIFY only after the surrounding transaction commits, so
// issuing it inside the state change cannot announce uncommitted state or be
// lost between commit and a separate publish.
export const notifyChannel = (channel: string, key: string) =>
  query((db) => db.execute(sql`select pg_notify(${channel}, ${key})`))

// Fans one Postgres LISTEN connection out to in-process subscribers by key.
export const makeChannelHub = Effect.fnUntraced(function* (
  channel: string,
  label: string
) {
  const database = yield* Database
  const hub = yield* PubSub.sliding<string>(1024)

  const listen = Effect.scoped(
    Effect.gen(function* () {
      const notifications = yield* database.listen(channel)
      // Anything missed while LISTEN was down is reconciled by reloading.
      yield* PubSub.publish(hub, everyKey)
      return yield* Stream.fromQueue(notifications).pipe(
        Stream.runForEach((key) => PubSub.publish(hub, key))
      )
    })
  )

  yield* listen.pipe(
    Effect.tapCause((cause) =>
      Effect.logWarning(`${label} LISTEN failed; reconnecting`, cause)
    ),
    Effect.retry(Schedule.spaced("2 seconds")),
    Effect.forkScoped
  )

  const subscribe = (key: string) =>
    PubSub.subscribe(hub).pipe(
      Effect.map((subscription) =>
        Stream.fromSubscription(subscription).pipe(
          Stream.filter((payload) => payload === key || payload === everyKey),
          Stream.as(undefined)
        )
      )
    )

  return { subscribe }
})
