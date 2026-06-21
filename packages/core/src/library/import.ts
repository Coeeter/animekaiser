import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import {
  animeMetadata,
  Database,
  externalListAccount,
  job,
  userLibraryEntry,
} from "@workspace/db"
import { and, asc, eq, sql } from "drizzle-orm"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Schema from "effect/Schema"

export const LIBRARY_IMPORT_JOB_CHANNEL = "library_import_jobs"
export const LIBRARY_IMPORT_JOB_UPDATE_CHANNEL = "library_import_job_updates"

type Status =
  | "watching"
  | "completed"
  | "paused"
  | "dropped"
  | "planning"
  | "rewatching"

type NormalizedEntry = {
  malId: number
  aniListId: number | null
  aniListEntryId: number | null
  titleRomaji: string
  titleEnglish: string | null
  coverImage: string | null
  episodes: number | null
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
  node: Schema.Struct({
    id: PositiveInt,
    title: Schema.String,
    alternative_titles: Schema.optional(
      Schema.Struct({
        en: Schema.optional(Schema.String),
        ja: Schema.optional(Schema.String),
      })
    ),
    main_picture: Schema.optional(
      Schema.Struct({
        medium: Schema.optional(Schema.String),
        large: Schema.optional(Schema.String),
      })
    ),
    num_episodes: Schema.optional(Schema.NonNegativeInt),
  }),
  list_status: Schema.Struct({
    status: MalStatus,
    score: Schema.Int.pipe(Schema.between(0, 10)),
    num_episodes_watched: Schema.NonNegativeInt,
    is_rewatching: Schema.Boolean,
    comments: Schema.optional(Schema.String),
  }),
})

export const MalImportResponse = Schema.Struct({
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
  notes: Schema.NullOr(Schema.String),
  media: Schema.NullOr(
    Schema.Struct({
      id: PositiveInt,
      idMal: Schema.NullOr(PositiveInt),
      title: Schema.NullOr(
        Schema.Struct({
          romaji: Schema.NullOr(Schema.String),
          english: Schema.NullOr(Schema.String),
        })
      ),
      coverImage: Schema.NullOr(
        Schema.Struct({
          extraLarge: Schema.NullOr(Schema.String),
          large: Schema.NullOr(Schema.String),
          medium: Schema.NullOr(Schema.String),
        })
      ),
      episodes: Schema.NullOr(PositiveInt),
    })
  ),
})

export const AniListImportResponse = Schema.Struct({
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
          id status score(format: POINT_100) progress notes
          media {
            id idMal title { romaji english }
            coverImage { extraLarge large medium }
            episodes
          }
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
  aniListId: null,
  aniListEntryId: null,
  titleRomaji: value.node.title.trim(),
  titleEnglish: value.node.alternative_titles?.en?.trim() || null,
  coverImage:
    value.node.main_picture?.large ?? value.node.main_picture?.medium ?? null,
  episodes:
    value.node.num_episodes && value.node.num_episodes > 0
      ? value.node.num_episodes
      : null,
  status: value.list_status.is_rewatching
    ? "rewatching"
    : normalizeLibraryStatus(value.list_status.status),
  score: value.list_status.score > 0 ? value.list_status.score * 10 : null,
  progress: value.list_status.num_episodes_watched,
  notes: value.list_status.comments?.trim() || null,
})

export const normalizeAniListImportEntry = (
  value: null | typeof AniListImportEntry.Type
): NormalizedEntry | null => {
  const malId = value?.media?.idMal
  const titleRomaji =
    value?.media?.title?.romaji?.trim() || value?.media?.title?.english?.trim()
  if (!malId || !titleRomaji) return null

  return {
    malId,
    aniListId: value.media.id,
    aniListEntryId: value.id,
    titleRomaji,
    titleEnglish: value.media.title?.english?.trim() || null,
    coverImage:
      value.media.coverImage?.extraLarge ??
      value.media.coverImage?.large ??
      value.media.coverImage?.medium ??
      null,
    episodes: value.media.episodes,
    status: normalizeLibraryStatus(value.status),
    score: value.score && value.score > 0 ? Math.round(value.score) : null,
    progress: value.progress ?? 0,
    notes: value.notes?.trim() || null,
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
  "@workspace/core/LibraryImportService",
  {
    accessors: true,
    dependencies: [FetchHttpClient.layer],
    effect: Effect.gen(function* () {
      const database = yield* Database
      const http = (yield* HttpClient.HttpClient).pipe(
        HttpClient.withTracerPropagation(false)
      )

      const fetchMalEntries = Effect.fn("LibraryImportService.fetchMalEntries")(
        function* (accessToken: string) {
          const entries: Array<NormalizedEntry> = []
          let next: string | null =
            "https://api.myanimelist.net/v2/users/@me/animelist?fields=list_status,alternative_titles,main_picture,num_episodes&limit=1000"

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
          return { entries, skippedCount: 0 }
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

        const providerEntries =
          response.data?.MediaListCollection?.lists?.flatMap(
            (list) => list?.entries ?? []
          ) ?? []
        const entries = providerEntries
          .map(normalizeAniListImportEntry)
          .filter((entry): entry is NormalizedEntry => entry !== null)
        return {
          entries,
          skippedCount: providerEntries.length - entries.length,
        }
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

      const getJob = Effect.fn("LibraryImportService.getJob")(function* (
        userId: string,
        id: string
      ) {
        const rows = yield* database.execute((db) =>
          db
            .select()
            .from(job)
            .where(
              and(
                eq(job.id, id),
                eq(job.userId, userId),
                eq(job.type, "library_import")
              )
            )
            .limit(1)
        )
        const row = rows.at(0)
        return row
          ? {
              id: row.id,
              provider: row.payload.provider,
              status: row.status,
              result: row.result,
              errorMessage: row.errorMessage,
            }
          : null
      })

      const watchJob = (userId: string, id: string) =>
        Stream.unwrapScoped(
          Effect.gen(function* () {
            const events = yield* database.listen(
              LIBRARY_IMPORT_JOB_UPDATE_CHANNEL
            )
            const initial = Stream.fromEffect(
              getJob(userId, id).pipe(
                Effect.flatMap((value) =>
                  value
                    ? Effect.succeed(value)
                    : Effect.fail(
                        new LibraryImportError({
                          message: "Import job was not found.",
                        })
                      )
                )
              )
            )
            const updates = Stream.fromQueue(events).pipe(
              Stream.filter(
                (event) => event._tag === "Error" || event.payload === id
              ),
              Stream.mapEffect((event) =>
                event._tag === "Error"
                  ? Effect.fail(
                      new LibraryImportError({
                        message: "Import status connection failed.",
                      })
                    )
                  : getJob(userId, id).pipe(
                      Effect.flatMap((value) =>
                        value
                          ? Effect.succeed(value)
                          : Effect.fail(
                              new LibraryImportError({
                                message: "Import job was not found.",
                              })
                            )
                      )
                    )
              )
            )
            return Stream.concat(initial, updates).pipe(
              Stream.takeUntil(
                (value) =>
                  value.status === "completed" || value.status === "failed"
              )
            )
          })
        )

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
          entries: ReadonlyArray<NormalizedEntry>,
          skippedCount: number
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
              let insertedCount = 0
              let updatedCount = 0
              let unchangedCount = 0

              for (const entry of entries) {
                await tx
                  .insert(animeMetadata)
                  .values({
                    malId: entry.malId,
                    aniListId: entry.aniListId,
                    titleRomaji: entry.titleRomaji,
                    titleEnglish: entry.titleEnglish,
                    coverImage: entry.coverImage,
                    episodes: entry.episodes,
                  })
                  .onConflictDoUpdate({
                    target: animeMetadata.malId,
                    set: {
                      aniListId: entry.aniListId,
                      titleRomaji: entry.titleRomaji,
                      titleEnglish: entry.titleEnglish,
                      coverImage: entry.coverImage,
                      episodes: entry.episodes,
                      updatedAt: new Date(),
                    },
                  })
                const existing = byMalId.get(entry.malId)
                if (!existing) {
                  await tx.insert(userLibraryEntry).values({
                    userId,
                    malId: entry.malId,
                    status: entry.status,
                    score: entry.score,
                    progress: entry.progress,
                    notes: entry.notes,
                    aniListEntryId: entry.aniListEntryId,
                  })
                  insertedCount += 1
                  continue
                }
                if (sameEntry(existing, entry)) {
                  unchangedCount += 1
                  continue
                }

                await tx
                  .update(userLibraryEntry)
                  .set({
                    status: entry.status,
                    score: entry.score,
                    progress: entry.progress,
                    notes: entry.notes,
                    aniListEntryId: entry.aniListEntryId,
                    updatedAt: new Date(),
                  })
                  .where(
                    and(
                      eq(userLibraryEntry.userId, userId),
                      eq(userLibraryEntry.malId, entry.malId)
                    )
                  )
                updatedCount += 1
              }

              return {
                insertedCount,
                updatedCount,
                unchangedCount,
                skippedCount,
              }
            })
          )
        }
      )

      const processNextJob = Effect.fn("LibraryImportService.processNextJob")(
        function* () {
          const next = yield* claimNextJob()
          if (!next) return false
          yield* database.execute((db) =>
            db.execute(
              sql`select pg_notify(${LIBRARY_IMPORT_JOB_UPDATE_CHANNEL}, ${next.id})`
            )
          )
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
            const imported =
              provider === "mal"
                ? yield* fetchMalEntries(account.accessToken)
                : yield* fetchAniListEntries(
                    account.accessToken,
                    account.providerAccountId
                  )
            return yield* persistEntries(
              next.userId,
              imported.entries,
              imported.skippedCount
            )
          })

          yield* program.pipe(
            Effect.flatMap((result) =>
              database.execute((db) =>
                db.transaction(async (tx) => {
                  await tx
                    .update(job)
                    .set({
                      status: "completed",
                      result,
                      errorMessage: null,
                      lockedAt: null,
                      updatedAt: new Date(),
                    })
                    .where(eq(job.id, next.id))
                  await tx.execute(
                    sql`select pg_notify(${LIBRARY_IMPORT_JOB_UPDATE_CHANNEL}, ${next.id})`
                  )
                })
              )
            ),
            Effect.catchAll((error) =>
              database
                .execute((db) =>
                  db.transaction(async (tx) => {
                    await tx
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
                    await tx.execute(
                      sql`select pg_notify(${LIBRARY_IMPORT_JOB_UPDATE_CHANNEL}, ${next.id})`
                    )
                  })
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

      return { recoverRunningJobs, processNextJob, getJob, watchJob }
    }),
  }
) {}
