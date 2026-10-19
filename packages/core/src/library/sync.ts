import {
  Database,
  externalListAccount,
  librarySyncEvent,
  userLibraryEntry,
} from "@animekaiser/db"
import { and, asc, eq, sql } from "drizzle-orm"
import * as Clock from "effect/Clock"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { logAniListRateLimit } from "../anime/anilist"
import { withoutTracePropagation } from "../http"

export class LibrarySyncError extends Schema.TaggedError<LibrarySyncError>()(
  "LibrarySyncError",
  {
    message: Schema.String,
    authenticationRejected: Schema.Boolean,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

const AniListError = Schema.Struct({
  message: Schema.String,
  status: Schema.optional(Schema.Int),
})

const AniListMediaResponse = Schema.Struct({
  data: Schema.NullOr(
    Schema.Struct({
      Media: Schema.NullOr(
        Schema.Struct({
          id: Schema.Int.check(Schema.isGreaterThan(0)),
          mediaListEntry: Schema.NullOr(
            Schema.Struct({ id: Schema.Int.check(Schema.isGreaterThan(0)) })
          ),
        })
      ),
    })
  ),
  errors: Schema.optional(Schema.Array(AniListError)),
})

const AniListSaveResponse = Schema.Struct({
  data: Schema.NullOr(
    Schema.Struct({
      SaveMediaListEntry: Schema.NullOr(
        Schema.Struct({ id: Schema.Int.check(Schema.isGreaterThan(0)) })
      ),
    })
  ),
  errors: Schema.optional(Schema.Array(AniListError)),
})

const AniListDeleteResponse = Schema.Struct({
  data: Schema.NullOr(
    Schema.Struct({
      DeleteMediaListEntry: Schema.NullOr(
        Schema.Struct({ deleted: Schema.Boolean })
      ),
    })
  ),
  errors: Schema.optional(Schema.Array(AniListError)),
})

const aniListStatus = (
  status: typeof librarySyncEvent.$inferSelect.payload.status
) => {
  if (status === "watching") return "CURRENT"
  if (status === "completed") return "COMPLETED"
  if (status === "paused") return "PAUSED"
  if (status === "dropped") return "DROPPED"
  if (status === "rewatching") return "REPEATING"
  return "PLANNING"
}

const aniListScore = (score: number | null) =>
  score === null ? null : score / 10

const malStatus = (
  status: typeof librarySyncEvent.$inferSelect.payload.status
) => {
  if (status === "watching" || status === "rewatching") return "watching"
  if (status === "completed") return "completed"
  if (status === "paused") return "on_hold"
  if (status === "dropped") return "dropped"
  return "plan_to_watch"
}

export const malListStatusParams = (
  payload: typeof librarySyncEvent.$inferSelect.payload
): Array<readonly [string, string]> => {
  const params: Array<readonly [string, string]> = [
    ["status", malStatus(payload.status)],
    ["num_watched_episodes", String(payload.progress)],
    ["is_rewatching", payload.status === "rewatching" ? "true" : "false"],
  ]
  if (payload.score !== null) {
    params.push(["score", String(Math.round(payload.score / 10))])
  }
  if (payload.notes) params.push(["comments", payload.notes])
  return params
}

export const nextSyncFailureStatus = (attempts: number) =>
  attempts >= 3 ? "failed" : "pending"

// An edit made while an event was running queues a newer pending event for the
// same entry. Returning the older one to pending would collide with it on the
// pending unique index, so it is superseded instead.
const pendingUnlessSuperseded = (status: "pending" | "failed") =>
  sql<"pending" | "failed" | "superseded">`case when exists (
    select 1 from ${librarySyncEvent} as newer
    where newer.user_id = ${librarySyncEvent.userId}
      and newer.mal_id = ${librarySyncEvent.malId}
      and newer.provider = ${librarySyncEvent.provider}
      and newer.status = 'pending'
      and newer.id <> ${librarySyncEvent.id}
  ) then 'superseded' else ${status} end`

export const aniListSaveMutation = (
  mediaId: number,
  payload: typeof librarySyncEvent.$inferSelect.payload
) => {
  const hasScore = payload.score !== null
  return {
    query: `mutation Save($mediaId:Int!,$status:MediaListStatus!${hasScore ? ",$score:Float!" : ""},$progress:Int!,$notes:String){SaveMediaListEntry(mediaId:$mediaId,status:$status${hasScore ? ",score:$score" : ""},progress:$progress,notes:$notes){id}}`,
    variables: {
      mediaId,
      status: aniListStatus(payload.status),
      ...(hasScore ? { score: aniListScore(payload.score) } : {}),
      progress: payload.progress,
      notes: payload.notes,
    },
  }
}

export class LibrarySyncService extends Context.Service<LibrarySyncService>()(
  "@animekaiser/core/LibrarySyncService",
  {
    make: Effect.gen(function* () {
      const database = yield* Database
      const http = (yield* HttpClient.HttpClient).pipe(withoutTracePropagation)

      const execute = (
        request: HttpClientRequest.HttpClientRequest,
        provider: "mal" | "anilist"
      ) =>
        http.execute(request).pipe(
          Effect.tap((response) =>
            provider === "anilist"
              ? logAniListRateLimit("library-sync")(response)
              : Effect.void
          ),
          Effect.mapError(
            (cause) =>
              new LibrarySyncError({
                message: `${provider} sync failed.`,
                authenticationRejected: false,
                cause,
              })
          ),
          Effect.flatMap((response) =>
            response.status === 401 || response.status === 403
              ? Effect.fail(
                  new LibrarySyncError({
                    message: `${provider} authorization was rejected.`,
                    authenticationRejected: true,
                  })
                )
              : HttpClientResponse.filterStatusOk(response).pipe(
                  Effect.mapError(
                    (cause) =>
                      new LibrarySyncError({
                        message: `${provider} sync failed.`,
                        authenticationRejected: false,
                        cause,
                      })
                  )
                )
          )
        )

      const aniListGraphQl = <TValue, TEncoded>(
        schema: Schema.Codec<TValue, TEncoded>,
        accessToken: string,
        query: string,
        variables: object
      ) =>
        HttpClientRequest.post("https://graphql.anilist.co", {
          headers: { authorization: `Bearer ${accessToken}` },
        }).pipe(
          HttpClientRequest.bodyJson({ query, variables }),
          Effect.mapError(
            (cause) =>
              new LibrarySyncError({
                message: "AniList request could not be encoded.",
                authenticationRejected: false,
                cause,
              })
          ),
          Effect.flatMap((request) => execute(request, "anilist")),
          Effect.flatMap((response) =>
            HttpClientResponse.schemaBodyJson(schema)(response).pipe(
              Effect.mapError(
                (cause) =>
                  new LibrarySyncError({
                    message: "AniList returned an invalid response.",
                    authenticationRejected: false,
                    cause,
                  })
              )
            )
          )
        )

      const resolveAniList = Effect.fn("LibrarySyncService.resolveAniList")(
        function* (accessToken: string, malId: number) {
          const response = yield* aniListGraphQl(
            AniListMediaResponse,
            accessToken,
            `query Resolve($malId:Int!){Media(type:ANIME,idMal:$malId){id mediaListEntry{id}}}`,
            { malId }
          )
          const error = response.errors?.[0]
          if (error) {
            return yield* new LibrarySyncError({
              message: error.message,
              authenticationRejected:
                error.status === 401 || error.status === 403,
            })
          }
          if (!response.data?.Media) {
            return yield* new LibrarySyncError({
              message: `AniList could not resolve MAL ${malId}.`,
              authenticationRejected: false,
            })
          }
          return response.data.Media
        }
      )

      const syncAniList = Effect.fn("LibrarySyncService.syncAniList")(
        function* (
          accessToken: string,
          event: typeof librarySyncEvent.$inferSelect
        ) {
          const resolved = yield* resolveAniList(accessToken, event.malId)
          if (event.action === "delete") {
            const entryId =
              event.payload.aniListEntryId ?? resolved.mediaListEntry?.id
            if (!entryId) return null
            const response = yield* aniListGraphQl(
              AniListDeleteResponse,
              accessToken,
              `mutation Delete($id:Int!){DeleteMediaListEntry(id:$id){deleted}}`,
              { id: entryId }
            )
            const error = response.errors?.[0]
            if (error) {
              return yield* new LibrarySyncError({
                message: error.message,
                authenticationRejected:
                  error.status === 401 || error.status === 403,
              })
            }
            return null
          }
          const mutation = aniListSaveMutation(resolved.id, event.payload)
          const response = yield* aniListGraphQl(
            AniListSaveResponse,
            accessToken,
            mutation.query,
            mutation.variables
          )
          const error = response.errors?.[0]
          if (error) {
            return yield* new LibrarySyncError({
              message: error.message,
              authenticationRejected:
                error.status === 401 || error.status === 403,
            })
          }
          return response.data?.SaveMediaListEntry?.id ?? null
        }
      )

      const syncMal = Effect.fn("LibrarySyncService.syncMal")(function* (
        accessToken: string,
        event: typeof librarySyncEvent.$inferSelect
      ) {
        const url = `https://api.myanimelist.net/v2/anime/${event.malId}/my_list_status`
        if (event.action === "delete") {
          yield* execute(
            HttpClientRequest.delete(url, {
              headers: { authorization: `Bearer ${accessToken}` },
            }),
            "mal"
          ).pipe(
            Effect.catchTag("LibrarySyncError", (error) =>
              error.authenticationRejected ? Effect.fail(error) : Effect.void
            )
          )
          return
        }
        yield* execute(
          HttpClientRequest.patch(url, {
            headers: { authorization: `Bearer ${accessToken}` },
          }).pipe(
            HttpClientRequest.bodyUrlParams(malListStatusParams(event.payload))
          ),
          "mal"
        )
      })

      const recoverRunningEvents = Effect.fn(
        "LibrarySyncService.recoverRunningEvents"
      )(function* () {
        const updatedAt = new Date(yield* Clock.currentTimeMillis)
        yield* database.execute((db) =>
          db
            .update(librarySyncEvent)
            .set({ status: pendingUnlessSuperseded("pending"), updatedAt })
            .where(eq(librarySyncEvent.status, "running"))
        )
      })

      const claimNextEvent = Effect.fn("LibrarySyncService.claimNextEvent")(
        function* () {
          const pending = yield* database.execute((db) =>
            db
              .select({ id: librarySyncEvent.id })
              .from(librarySyncEvent)
              .where(eq(librarySyncEvent.status, "pending"))
              .orderBy(asc(librarySyncEvent.createdAt))
              .limit(1)
          )
          const id = pending[0]?.id
          if (!id) return null
          const updatedAt = new Date(yield* Clock.currentTimeMillis)
          const claimed = yield* database.execute((db) =>
            db
              .update(librarySyncEvent)
              .set({
                status: "running",
                attempts: sql`${librarySyncEvent.attempts} + 1`,
                updatedAt,
              })
              .where(
                and(
                  eq(librarySyncEvent.id, id),
                  eq(librarySyncEvent.status, "pending")
                )
              )
              .returning()
          )
          return claimed[0] ?? null
        }
      )

      const processNextEvent = Effect.fn("LibrarySyncService.processNextEvent")(
        function* () {
          const event = yield* claimNextEvent()
          if (!event) return false
          const accounts = yield* database.execute((db) =>
            db
              .select()
              .from(externalListAccount)
              .where(
                and(
                  eq(externalListAccount.userId, event.userId),
                  eq(externalListAccount.provider, event.provider)
                )
              )
              .limit(1)
          )
          const account = accounts.at(0) ?? null
          const sync = account
            ? event.provider === "mal"
              ? syncMal(account.accessToken, event)
              : syncAniList(account.accessToken, event)
            : Effect.fail(
                new LibrarySyncError({
                  message: "External account is not linked.",
                  authenticationRejected: true,
                })
              )

          yield* Effect.gen(function* () {
            const aniListEntryId = yield* sync
            if (typeof aniListEntryId === "number")
              yield* database.execute((db) =>
                db
                  .update(userLibraryEntry)
                  .set({ aniListEntryId })
                  .where(
                    and(
                      eq(userLibraryEntry.userId, event.userId),
                      eq(userLibraryEntry.malId, event.malId)
                    )
                  )
              )
            const updatedAt = new Date(yield* Clock.currentTimeMillis)
            yield* database.execute((db) =>
              db
                .update(librarySyncEvent)
                .set({ status: "completed", errorMessage: null, updatedAt })
                .where(eq(librarySyncEvent.id, event.id))
            )
          }).pipe(
            Effect.catchTag("LibrarySyncError", (error) =>
              Effect.gen(function* () {
                const updatedAt = new Date(yield* Clock.currentTimeMillis)
                yield* database.execute((db) =>
                  db
                    .update(librarySyncEvent)
                    .set({
                      status: pendingUnlessSuperseded(
                        nextSyncFailureStatus(event.attempts)
                      ),
                      errorMessage: error.message,
                      updatedAt,
                    })
                    .where(eq(librarySyncEvent.id, event.id))
                )
                if (error.authenticationRejected && account !== null)
                  yield* database.execute((db) =>
                    db
                      .update(externalListAccount)
                      .set({ relinkRequiredAt: updatedAt, updatedAt })
                      .where(eq(externalListAccount.id, account.id))
                  )
              }).pipe(database.transaction)
            )
          )
          return true
        }
      )

      return { recoverRunningEvents, processNextEvent }
    }),
  }
) {
  static readonly layer = Layer.effect(
    LibrarySyncService,
    LibrarySyncService.make
  ).pipe(Layer.provide(FetchHttpClient.layer))
}
