import { drizzle } from "drizzle-orm/postgres-js"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { DatabaseError as PgDatabaseError, Pool } from "pg"
import * as schema from "./schema"

export type DatabaseConnectionConfig = {
  url: string
  ssl?: boolean
}

export class DatabaseConnectionError extends Data.TaggedError(
  "DatabaseConnectionError"
)<{
  message: string
  cause?: unknown
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  type: "unique_violation" | "foreign_key_violation" | "connection_error"
  cause: PgDatabaseError
}> {
  public override toString(): string {
    return `[DatabaseError] ${this.type}: ${this.cause.message}`
  }

  public get message() {
    return this.cause.message
  }
}

const makeService = (config: DatabaseConnectionConfig) =>
  Effect.gen(function* () {
    const pool = yield* Effect.acquireRelease(
      Effect.sync(
        () =>
          new Pool({
            connectionString: config.url,
            ssl: config.ssl,
          })
      ),
      (p) => Effect.promise(() => p.end())
    )

    yield* Effect.tryPromise(() => pool.query("SELECT 1")).pipe(
      Effect.timeoutFail({
        duration: "10  seconds",
        onTimeout: () =>
          new DatabaseConnectionError({
            message:
              "[Database] Connection attempt timed out after 10 seconds.",
            cause: new Error("[Database] Connection timeout"),
          }),
      }),
      Effect.catchTag(
        "UnknownException",
        (error) =>
          new DatabaseConnectionError({
            message:
              "[Database] Failed to establish a connection to the database.",
            cause: error.cause,
          })
      ),
      Effect.tap(() =>
        Effect.logInfo("[Database] Connection established successfully.")
      )
    )

    const db = drizzle(pool, { schema })

    const setupConnectionListeners = Effect.zipRight(
      Effect.async<void, DatabaseConnectionError>((resume) => {
        pool.on("error", (error) => {
          resume(
            Effect.fail(
              new DatabaseConnectionError({
                message: "[Database] Connection error occurred.",
                cause: error,
              })
            )
          )
        })

        return Effect.sync(() => {
          pool.removeAllListeners("error")
        })
      }),
      Effect.logInfo("[Database] Connection error listeners set up."),
      {
        concurrent: true,
      }
    )

    const execute = Effect.fn(<T>(fn: (client: typeof db) => Promise<T>) => {
      return Effect.tryPromise({
        try: () => fn(db),
        catch: (error) => {
          const isPgError = error instanceof PgDatabaseError
          if (!isPgError) throw error // Just crash for unknown errors

          switch (error.code) {
            case "23505":
              return new DatabaseError({
                type: "unique_violation",
                cause: error,
              })
            case "23503":
              return new DatabaseError({
                type: "foreign_key_violation",
                cause: error,
              })
            case "08000":
              return new DatabaseError({
                type: "connection_error",
                cause: error,
              })
          }
        },
      })
    })

    return { setupConnectionListeners, execute }
  })

type Shape = Effect.Effect.Success<ReturnType<typeof makeService>>

export class Database extends Context.Tag("@workspace/db/db/Database")<
  Database,
  Shape
>() {
  static layer(config: DatabaseConnectionConfig) {
    return Layer.scoped(this, makeService(config))
  }
}
