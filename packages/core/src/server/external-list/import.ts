import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import {
  Database,
  externalListAccount,
  job,
  libraryConflict,
  userLibraryEntry,
} from "@workspace/db"
import { and, asc, eq } from "drizzle-orm"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

type Provider = "mal" | "anilist"
export const LIBRARY_IMPORT_JOB_CHANNEL = "library_import_jobs"

type Status =
  | "watching"
  | "completed"
  | "paused"
  | "dropped"
  | "planning"
  | "rewatching"

type NormalizedEntry = {
  malId: number
  aniListEntryId: number | null
  status: Status
  score: number | null
  progress: number
  notes: string | null
}

export class LibraryImportError extends Schema.TaggedError<LibraryImportError>()(
  "LibraryImportError",
  { message: Schema.String }
) {}

const PositiveInt = Schema.Int.pipe(Schema.positive())
const MalStatus = Schema.Literal(
  "watching",
  "completed",
  "on_hold",
  "dropped",
  "plan_to_watch"
)
const AniListStatus = Schema.Literal(
  "CURRENT",
  "PLANNING",
  "COMPLETED",
  "DROPPED",
  "PAUSED",
  "REPEATING"
)

const MalImportEntry = Schema.Struct({
  node: Schema.Struct({ id: PositiveInt }),
  list_status: Schema.Struct({
    status: MalStatus,
    score: Schema.Int.pipe(Schema.between(0, 10)),
    num_episodes_watched: Schema.NonNegativeInt,
    is_rewatching: Schema.Boolean,
  }),
})

const MalImportResponse = Schema.Struct({
  data: Schema.Array(MalImportEntry),
  paging: Schema.Struct({
    previous: Schema.optional(Schema.String),
    next: Schema.optional(Schema.String),
  }),
})

const AniListImportEntry = Schema.Struct({
  id: PositiveInt,
  status: Schema.NullOr(AniListStatus),
  score: Schema.NullOr(Schema.Number.pipe(Schema.between(0, 100))),
  progress: Schema.NullOr(Schema.NonNegativeInt),
  media: Schema.NullOr(Schema.Struct({ idMal: Schema.NullOr(PositiveInt) })),
})

const AniListImportResponse = Schema.Struct({
  data: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        MediaListCollection: Schema.optional(
          Schema.NullOr(
            Schema.Struct({
              lists: Schema.optional(
                Schema.NullOr(
                  Schema.Array(
                    Schema.NullOr(
                      Schema.Struct({
                        entries: Schema.optional(
                          Schema.NullOr(
                            Schema.Array(Schema.NullOr(AniListImportEntry))
                          )
                        ),
                      })
                    )
                  )
                )
              ),
            })
          )
        ),
      })
    )
  ),
  errors: Schema.optional(
    Schema.Array(Schema.Struct({ message: Schema.String }))
  ),
})

const aniListImportQuery = `
  query ViewerList($userId: Int!) {
    MediaListCollection(userId: $userId, type: ANIME) {
      lists {
        entries {
          id status score(format: POINT_100) progress
          media { idMal }
        }
      }
    }
  }
`

type ProviderStatus = typeof MalStatus.Type | typeof AniListStatus.Type | null

export const normalizeLibraryStatus = (value: ProviderStatus): Status => {
  switch (value) {
    case "CURRENT":
    case "watching":
      return "watching"
    case "COMPLETED":
    case "completed":
      return "completed"
    case "PAUSED":
    case "on_hold":
      return "paused"
    case "DROPPED":
    case "dropped":
      return "dropped"
    case "REPEATING":
      return "rewatching"
    default:
      return "planning"
  }
}

export const normalizeMalImportEntry = (
  value: typeof MalImportEntry.Type
): NormalizedEntry => ({
  malId: value.node.id,
  aniListEntryId: null,
  status: value.list_status.is_rewatching
    ? "rewatching"
    : normalizeLibraryStatus(value.list_status.status),
  score: value.list_status.score > 0 ? value.list_status.score * 10 : null,
  progress: value.list_status.num_episodes_watched,
  notes: null,
})

export const normalizeAniListImportEntry = (
  value: null | typeof AniListImportEntry.Type
): NormalizedEntry | null => {
  const malId = value?.media?.idMal
  if (!malId) return null

  return {
    malId,
    aniListEntryId: value.id,
    status: normalizeLibraryStatus(value.status),
    score: value.score && value.score > 0 ? Math.round(value.score) : null,
    progress: value.progress ?? 0,
    notes: null,
  }
}

const sameEntry = (
  left: Pick<NormalizedEntry, "status" | "score" | "progress" | "notes">,
  right: Pick<NormalizedEntry, "status" | "score" | "progress" | "notes">
) =>
  left.status === right.status &&
  left.score === right.score &&
  left.progress === right.progress &&
  left.notes === right.notes

export class LibraryImportService extends Effect.Service<LibraryImportService>()(
  "@workspace/core/server/LibraryImportService",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const database = yield* Database
      const http = (yield* HttpClient.HttpClient).pipe(
        HttpClient.withTracerPropagation(false)
      )

      const fetchMalEntries = Effect.fn("LibraryImportService.fetchMalEntries")(
        function* (accessToken: string) {
          const entries: Array<NormalizedEntry> = []
          let next: string | null =
            "https://api.myanimelist.net/v2/users/@me/animelist?fields=list_status&limit=1000"

          while (next) {
            const response: typeof MalImportResponse.Type = yield* http
              .execute(
                HttpClientRequest.get(next, {
                  headers: { authorization: `Bearer ${accessToken}` },
                })
              )
              .pipe(
                Effect.flatMap(HttpClientResponse.filterStatusOk),
                Effect.flatMap(
                  HttpClientResponse.schemaBodyJson(MalImportResponse)
                ),
                Effect.mapError(
                  () =>
                    new LibraryImportError({ message: "MAL import failed." })
                )
              )

            for (const item of response.data) {
              entries.push(normalizeMalImportEntry(item))
            }
            next = response.paging.next ?? null
          }
          return entries
        }
      )

      const fetchAniListEntries = Effect.fn(
        "LibraryImportService.fetchAniListEntries"
      )(function* (accessToken: string, providerAccountId: string) {
        const userId = Number.parseInt(providerAccountId, 10)
        if (!Number.isInteger(userId)) {
          return yield* new LibraryImportError({
            message: "AniList account identifier is invalid.",
          })
        }

        const request = HttpClientRequest.post("https://graphql.anilist.co", {
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
        }).pipe(
          HttpClientRequest.bodyUnsafeJson({
            query: aniListImportQuery,
            variables: { userId },
          })
        )
        const response = yield* http.execute(request).pipe(
          Effect.flatMap(HttpClientResponse.filterStatusOk),
          Effect.flatMap(
            HttpClientResponse.schemaBodyJson(AniListImportResponse)
          ),
          Effect.mapError(
            () => new LibraryImportError({ message: "AniList import failed." })
          )
        )
        if (response.errors?.length) {
          return yield* new LibraryImportError({
            message: response.errors[0]?.message ?? "AniList import failed.",
          })
        }

        return (
          response.data?.MediaListCollection?.lists
            ?.flatMap((list) => list?.entries ?? [])
            .map(normalizeAniListImportEntry)
            .filter((entry): entry is NormalizedEntry => entry !== null) ?? []
        )
      })

      const recoverRunningJobs = Effect.fn(
        "LibraryImportService.recoverRunningJobs"
      )(function* () {
        yield* database.execute((db) =>
          db
            .update(job)
            .set({ status: "pending", lockedAt: null, updatedAt: new Date() })
            .where(
              and(eq(job.type, "library_import"), eq(job.status, "running"))
            )
        )
      })

      const claimNextJob = Effect.fn("LibraryImportService.claimNextJob")(
        function* () {
          // ponytail: one API worker claims jobs; use SKIP LOCKED if workers multiply.
          const pending = yield* database.execute((db) =>
            db
              .select()
              .from(job)
              .where(
                and(eq(job.type, "library_import"), eq(job.status, "pending"))
              )
              .orderBy(asc(job.availableAt))
              .limit(1)
          )
          const next = pending.at(0)
          if (!next) return null

          const claimed = yield* database.execute((db) =>
            db
              .update(job)
              .set({
                status: "running",
                attempts: next.attempts + 1,
                lockedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(and(eq(job.id, next.id), eq(job.status, "pending")))
              .returning()
          )
          return claimed.at(0) ?? null
        }
      )

      const persistEntries = Effect.fn("LibraryImportService.persistEntries")(
        function* (
          userId: string,
          provider: Provider,
          entries: ReadonlyArray<NormalizedEntry>
        ) {
          return yield* database.execute((db) =>
            db.transaction(async (tx) => {
              const current = await tx
                .select()
                .from(userLibraryEntry)
                .where(eq(userLibraryEntry.userId, userId))
              const byMalId = new Map(
                current.map((entry) => [entry.malId, entry])
              )
              let importedCount = 0
              let conflictCount = 0
              let skippedCount = 0

              for (const entry of entries) {
                const existing = byMalId.get(entry.malId)
                if (!existing) {
                  await tx.insert(userLibraryEntry).values({ userId, ...entry })
                  importedCount += 1
                  continue
                }
                if (sameEntry(existing, entry)) {
                  skippedCount += 1
                  continue
                }

                await tx
                  .insert(libraryConflict)
                  .values({
                    id: crypto.randomUUID(),
                    userId,
                    malId: entry.malId,
                    provider,
                    localValue: {
                      status: existing.status,
                      score: existing.score,
                      progress: existing.progress,
                      notes: existing.notes,
                    },
                    externalValue: {
                      status: entry.status,
                      score: entry.score,
                      progress: entry.progress,
                      notes: entry.notes,
                    },
                  })
                  .onConflictDoUpdate({
                    target: [
                      libraryConflict.userId,
                      libraryConflict.malId,
                      libraryConflict.provider,
                    ],
                    set: {
                      externalValue: {
                        status: entry.status,
                        score: entry.score,
                        progress: entry.progress,
                        notes: entry.notes,
                      },
                      status: "pending",
                      resolvedAt: null,
                    },
                  })
                conflictCount += 1
              }

              return { importedCount, conflictCount, skippedCount }
            })
          )
        }
      )

      const processNextJob = Effect.fn("LibraryImportService.processNextJob")(
        function* () {
          const next = yield* claimNextJob()
          if (!next) return false
          const provider = next.payload.provider

          const program = Effect.gen(function* () {
            const accounts = yield* database.execute((db) =>
              db
                .select()
                .from(externalListAccount)
                .where(
                  and(
                    eq(externalListAccount.userId, next.userId),
                    eq(externalListAccount.provider, provider)
                  )
                )
                .limit(1)
            )
            const account = accounts.at(0)
            if (!account) {
              return yield* new LibraryImportError({
                message: "External list account is not connected.",
              })
            }
            const entries =
              provider === "mal"
                ? yield* fetchMalEntries(account.accessToken)
                : yield* fetchAniListEntries(
                    account.accessToken,
                    account.providerAccountId
                  )
            return yield* persistEntries(next.userId, provider, entries)
          })

          yield* program.pipe(
            Effect.flatMap((result) =>
              database.execute((db) =>
                db
                  .update(job)
                  .set({
                    status: "completed",
                    result,
                    errorMessage: null,
                    lockedAt: null,
                    updatedAt: new Date(),
                  })
                  .where(eq(job.id, next.id))
              )
            ),
            Effect.catchAll((error) =>
              database
                .execute((db) =>
                  db
                    .update(job)
                    .set({
                      status: "failed",
                      errorMessage:
                        "message" in error
                          ? String(error.message)
                          : "Library import failed.",
                      lockedAt: null,
                      updatedAt: new Date(),
                    })
                    .where(eq(job.id, next.id))
                )
                .pipe(
                  Effect.zipRight(
                    Effect.logError("Library import failed", { error })
                  )
                )
            )
          )
          return true
        }
      )

      return { recoverRunningJobs, processNextJob }
    }),
  }
) {}
