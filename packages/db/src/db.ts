import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import type { PgDatabase } from "drizzle-orm/pg-core"
import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Filter from "effect/Filter"
import * as Layer from "effect/Layer"
import type * as Predicate from "effect/Predicate"
import * as Queue from "effect/Queue"
import * as Result from "effect/Result"
import type { Notification } from "pg"
import { escapeIdentifier, DatabaseError as PgDatabaseError, Pool } from "pg"
import * as schema from "./schema"

export type DatabaseConnectionConfig = {
  url: string
  ssl?: boolean
  migrationsFolder: string
}

export const createPgPool = (
  config: Pick<DatabaseConnectionConfig, "url" | "ssl">
) =>
  new Pool({
    connectionString: config.url,
    ssl: config.ssl,
  })

export const createDrizzleClient = (pool: Pool) => drizzle(pool, { schema })

export type KaiserDb = ReturnType<typeof createDrizzleClient>

export type KaiserExecutor = PgDatabase<NodePgQueryResultHKT, typeof schema>

export class DatabaseConnectionError extends Data.TaggedError(
  "DatabaseConnectionError"
)<{
  message: string
  cause?: unknown
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  type:
    | "unique_violation"
    | "foreign_key_violation"
    | "connection_error"
    | "query_error"
  cause: unknown
}> {
  public override toString(): string {
    return `[DatabaseError] ${this.type}: ${this.message}`
  }

  public get message() {
    return this.cause instanceof Error ? this.cause.message : "Unknown error"
  }
}

export class DatabaseMigrationError extends Data.TaggedError(
  "DatabaseMigrationError"
)<{
  cause: unknown
}> {}

// Domain errors thrown inside a query callback reach the caller as a
// DatabaseError cause; this filter moves them back into the error channel.
export const thrownBy = <E>(
  refinement: Predicate.Refinement<unknown, E>
): Filter.Filter<DatabaseError, E, DatabaseError> =>
  Filter.make((error) =>
    refinement(error.cause) ? Result.succeed(error.cause) : Result.fail(error)
  )

const toDatabaseError = (cause: unknown) => {
  if (cause instanceof PgDatabaseError) {
    switch (cause.code) {
      case "23505":
        return new DatabaseError({ type: "unique_violation", cause })
      case "23503":
        return new DatabaseError({ type: "foreign_key_violation", cause })
      case "08000":
        return new DatabaseError({ type: "connection_error", cause })
    }
  }
  return new DatabaseError({ type: "query_error", cause })
}

const make = Effect.fnUntraced(function* (config: DatabaseConnectionConfig) {
  const pool = yield* Effect.acquireRelease(
    Effect.sync(() => createPgPool(config)),
    (p) => Effect.promise(() => p.end())
  )

  yield* Effect.tryPromise({
    try: () => pool.query("SELECT 1"),
    catch: (cause) =>
      new DatabaseConnectionError({
        message: "[Database] Failed to establish a connection to the database.",
        cause,
      }),
  }).pipe(
    Effect.timeoutOrElse({
      duration: "10 seconds",
      orElse: () =>
        Effect.fail(
          new DatabaseConnectionError({
            message:
              "[Database] Connection attempt timed out after 10 seconds.",
          })
        ),
    })
  )
  yield* Effect.logInfo("[Database] Connection established successfully.")

  const db = createDrizzleClient(pool)

  yield* Effect.logInfo("[Database] Running migrations...")
  yield* Effect.tryPromise({
    try: () => migrate(db, { migrationsFolder: config.migrationsFolder }),
    catch: (cause) => new DatabaseMigrationError({ cause }),
  })
  yield* Effect.logInfo("[Database] Migrations complete.")

  const awaitConnectionError = Effect.logInfo(
    "[Database] Connection error listeners set up."
  ).pipe(
    Effect.andThen(
      Effect.callback<never, DatabaseConnectionError>((resume) => {
        const onError = (cause: Error) =>
          resume(
            Effect.fail(
              new DatabaseConnectionError({
                message: "[Database] Connection error occurred.",
                cause,
              })
            )
          )
        pool.on("error", onError)
        return Effect.sync(() => {
          pool.removeListener("error", onError)
        })
      })
    )
  )

  const execute = <T>(fn: (client: KaiserDb) => Promise<T>) =>
    Effect.tryPromise({ try: () => fn(db), catch: toDatabaseError })

  const listen = Effect.fn("Database.listen")(function* (channel: string) {
    let connectionFailed = false
    const client = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => pool.connect(),
        catch: (cause) =>
          new DatabaseError({ type: "connection_error", cause }),
      }),
      (poolClient) => Effect.sync(() => poolClient.release(connectionFailed))
    )
    const notifications = yield* Queue.unbounded<string, DatabaseError>()
    const onNotification = (notification: Notification) => {
      if (notification.channel === channel) {
        Queue.offerUnsafe(notifications, notification.payload ?? "")
      }
    }
    const onError = (cause: Error) => {
      connectionFailed = true
      Queue.failCauseUnsafe(
        notifications,
        Cause.fail(new DatabaseError({ type: "connection_error", cause }))
      )
    }

    yield* Effect.acquireRelease(
      Effect.sync(() => {
        client.on("notification", onNotification)
        client.on("error", onError)
      }),
      () =>
        Effect.sync(() => {
          client.removeListener("notification", onNotification)
          client.removeListener("error", onError)
        })
    )

    const identifier = escapeIdentifier(channel)
    yield* Effect.tryPromise({
      try: () => client.query(`LISTEN ${identifier}`),
      catch: (cause) => new DatabaseError({ type: "query_error", cause }),
    })
    yield* Effect.addFinalizer(() =>
      Effect.promise(() => client.query(`UNLISTEN ${identifier}`)).pipe(
        Effect.ignoreCause
      )
    )

    return Queue.asDequeue(notifications)
  })

  return { client: db, awaitConnectionError, execute, listen }
})

export type DatabaseService = Effect.Success<ReturnType<typeof make>>

export class Database extends Context.Service<Database, DatabaseService>()(
  "@animekaiser/db/Database"
) {
  static readonly layer = (config: DatabaseConnectionConfig) =>
    Layer.effect(Database, make(config))
}
