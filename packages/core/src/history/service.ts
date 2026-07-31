import { animeMetadata, Database, watchHistory } from "@animekaiser/db"
import type {
  AnimeLibraryMetadata,
  ContinueWatchingItem,
  StreamAudio,
  StreamProviderId,
  WatchHistoryStatus,
} from "@animekaiser/domain"
import { and, desc, eq, sql } from "drizzle-orm"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

export class WatchHistoryServiceError extends Schema.TaggedError<WatchHistoryServiceError>()(
  "WatchHistoryServiceError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}

// Streams end slightly before their reported duration, so requiring 100%
// would leave episodes stuck as "watching".
const completionRatio = 0.92

const resolveStatus = (
  positionSeconds: number,
  durationSeconds: number | null
): WatchHistoryStatus =>
  durationSeconds !== null &&
  durationSeconds > 0 &&
  positionSeconds >= durationSeconds * completionRatio
    ? "completed"
    : "watching"

type HistoryRow = typeof watchHistory.$inferSelect

const toEntry = (row: HistoryRow) => ({
  malId: row.malId,
  provider: row.provider as StreamProviderId,
  episodeId: row.episodeId,
  serverId: row.serverId,
  serverName: row.serverName,
  episode: row.episode,
  audio: row.audio as StreamAudio,
  positionSeconds: row.positionSeconds,
  durationSeconds: row.durationSeconds,
  status: row.status,
  updatedAt: row.updatedAt,
})

export class WatchHistoryService extends Effect.Service<WatchHistoryService>()(
  "@animekaiser/core/WatchHistoryService",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const database = yield* Database

      const record = Effect.fn("WatchHistoryService.record")(function* (
        userId: string,
        input: {
          anime: AnimeLibraryMetadata
          provider: StreamProviderId
          episodeId: string
          serverId: string | null
          serverName: string | null
          episode: number
          audio: StreamAudio
          positionSeconds: number
          durationSeconds: number | null
        }
      ) {
        const status = resolveStatus(
          input.positionSeconds,
          input.durationSeconds
        )

        const rows = yield* database
          .execute((db) =>
            db.transaction(async (tx) => {
              await tx
                .insert(animeMetadata)
                .values({
                  malId: input.anime.malId,
                  aniListId: input.anime.aniListId,
                  titleRomaji: input.anime.title.romaji,
                  titleEnglish: input.anime.title.english,
                  coverImage: input.anime.coverImage,
                  episodes: input.anime.episodes,
                })
                .onConflictDoNothing({ target: animeMetadata.malId })

              return await tx
                .insert(watchHistory)
                .values({
                  userId,
                  malId: input.anime.malId,
                  provider: input.provider,
                  episodeId: input.episodeId,
                  serverId: input.serverId,
                  serverName: input.serverName,
                  episode: input.episode,
                  audio: input.audio,
                  positionSeconds: input.positionSeconds,
                  durationSeconds: input.durationSeconds,
                  status,
                })
                .onConflictDoUpdate({
                  target: [
                    watchHistory.userId,
                    watchHistory.malId,
                    watchHistory.episode,
                  ],
                  set: {
                    provider: input.provider,
                    episodeId: input.episodeId,
                    serverId: input.serverId,
                    serverName: input.serverName,
                    audio: input.audio,
                    positionSeconds: input.positionSeconds,
                    durationSeconds: input.durationSeconds,
                    status,
                    updatedAt: new Date(),
                  },
                })
                .returning()
            })
          )
          .pipe(
            Effect.mapError(
              (cause) =>
                new WatchHistoryServiceError({
                  message: "Unable to record watch progress.",
                  cause,
                })
            )
          )

        const row = rows.at(0)
        if (!row) {
          return yield* new WatchHistoryServiceError({
            message: "Unable to record watch progress.",
          })
        }

        return toEntry(row)
      })

      const getEpisode = Effect.fn("WatchHistoryService.getEpisode")(function* (
        userId: string,
        malId: number,
        episode: number
      ) {
        const rows = yield* database
          .execute((db) =>
            db
              .select()
              .from(watchHistory)
              .where(
                and(
                  eq(watchHistory.userId, userId),
                  eq(watchHistory.malId, malId),
                  eq(watchHistory.episode, episode)
                )
              )
              .limit(1)
          )
          .pipe(
            Effect.mapError(
              (cause) =>
                new WatchHistoryServiceError({
                  message: "Unable to load watch progress.",
                  cause,
                })
            )
          )

        const row = rows.at(0)
        return row ? toEntry(row) : null
      })

      const listContinueWatching = Effect.fn(
        "WatchHistoryService.listContinueWatching"
      )(function* (userId: string, limit: number) {
        const rows = yield* database
          .execute((db) => {
            const latest = db
              .selectDistinctOn([watchHistory.malId])
              .from(watchHistory)
              .where(
                and(
                  eq(watchHistory.userId, userId),
                  eq(watchHistory.status, "watching")
                )
              )
              .orderBy(watchHistory.malId, desc(watchHistory.updatedAt))
              .as("latest_watch_history")

            return db
              .select({ history: watchHistory, anime: animeMetadata })
              .from(latest)
              .innerJoin(watchHistory, eq(watchHistory.id, latest.id))
              .innerJoin(
                animeMetadata,
                eq(watchHistory.malId, animeMetadata.malId)
              )
              .orderBy(desc(watchHistory.updatedAt))
              .limit(limit)
          })
          .pipe(
            Effect.mapError(
              (cause) =>
                new WatchHistoryServiceError({
                  message: "Unable to load continue watching.",
                  cause,
                })
            )
          )

        return rows.map(
          (row) =>
            ({
              ...toEntry(row.history),
              anime: {
                malId: row.anime.malId,
                aniListId: row.anime.aniListId,
                title: {
                  romaji: row.anime.titleRomaji,
                  english: row.anime.titleEnglish,
                },
                coverImage: row.anime.coverImage,
                episodes: row.anime.episodes,
              },
            }) satisfies ContinueWatchingItem
        )
      })

      const listHistory = Effect.fn("WatchHistoryService.listHistory")(
        function* (
          userId: string,
          page: number,
          perPage: number,
          query?: string
        ) {
          const search = query?.trim()
          const searchFilter = search
            ? sql`(${animeMetadata.titleRomaji} ilike ${`%${search}%`} or coalesce(${animeMetadata.titleEnglish}, '') ilike ${`%${search}%`})`
            : undefined

          const rows = yield* database
            .execute((db) =>
              db
                .select({ history: watchHistory, anime: animeMetadata })
                .from(watchHistory)
                .innerJoin(
                  animeMetadata,
                  eq(watchHistory.malId, animeMetadata.malId)
                )
                .where(and(eq(watchHistory.userId, userId), searchFilter))
                .orderBy(desc(watchHistory.updatedAt), desc(watchHistory.malId))
                .limit(perPage + 1)
                .offset((page - 1) * perPage)
            )
            .pipe(
              Effect.mapError(
                (cause) =>
                  new WatchHistoryServiceError({
                    message: "Unable to load watch history.",
                    cause,
                  })
              )
            )

          const hasNextPage = rows.length > perPage

          return {
            items: rows.slice(0, perPage).map(
              (row) =>
                ({
                  ...toEntry(row.history),
                  anime: {
                    malId: row.anime.malId,
                    aniListId: row.anime.aniListId,
                    title: {
                      romaji: row.anime.titleRomaji,
                      english: row.anime.titleEnglish,
                    },
                    coverImage: row.anime.coverImage,
                    episodes: row.anime.episodes,
                  },
                }) satisfies ContinueWatchingItem
            ),
            hasNextPage,
          }
        }
      )

      const clearAll = Effect.fn("WatchHistoryService.clearAll")(function* (
        userId: string
      ) {
        yield* database
          .execute((db) =>
            db.delete(watchHistory).where(eq(watchHistory.userId, userId))
          )
          .pipe(
            Effect.mapError(
              (cause) =>
                new WatchHistoryServiceError({
                  message: "Unable to clear watch history.",
                  cause,
                })
            )
          )
      })

      const clearForAnime = Effect.fn("WatchHistoryService.clearForAnime")(
        function* (userId: string, malId: number) {
          yield* database
            .execute((db) =>
              db
                .delete(watchHistory)
                .where(
                  and(
                    eq(watchHistory.userId, userId),
                    eq(watchHistory.malId, malId)
                  )
                )
            )
            .pipe(
              Effect.mapError(
                (cause) =>
                  new WatchHistoryServiceError({
                    message: "Unable to clear watch history.",
                    cause,
                  })
              )
            )
        }
      )

      return {
        record,
        getEpisode,
        listContinueWatching,
        listHistory,
        clearForAnime,
        clearAll,
      }
    }),
  }
) {}
