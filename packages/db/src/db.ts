import { drizzle } from "drizzle-orm/node-postgres"
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

export const createPgPool = (config: DatabaseConnectionConfig) =>
  new Pool({
    connectionString: config.url,
    ssl: config.ssl,
  })

export const createDrizzleClient = (pool: Pool) => drizzle(pool, { schema })

export type KaiserDb = ReturnType<typeof createDrizzleClient>

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

const makeService = (config: DatabaseConnectionConfig) =>
  Effect.gen(function* () {
    const pool = yield* Effect.acquireRelease(
      Effect.sync(() => createPgPool(config)),
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

    const db = createDrizzleClient(pool)

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
        catch: (cause) => {
          if (cause instanceof PgDatabaseError) {
            switch (cause.code) {
              case "23505":
                return new DatabaseError({
                  type: "unique_violation",
                  cause,
                })
              case "23503":
                return new DatabaseError({
                  type: "foreign_key_violation",
                  cause,
                })
              case "08000":
                return new DatabaseError({
                  type: "connection_error",
                  cause,
                })
            }
          }
          return new DatabaseError({ type: "query_error", cause })
        },
      })
    })

    const withClient = <T>(fn: (client: typeof db) => T) => fn(db)

    return { setupConnectionListeners, execute, withClient }
  })

type Shape = Effect.Effect.Success<ReturnType<typeof makeService>>
export type DatabaseService = Shape

export class Database extends Context.Tag("@workspace/db/db/Database")<
  Database,
  Shape
>() {
  static layer(config: DatabaseConnectionConfig) {
    return Layer.scoped(this, makeService(config))
  }
}
