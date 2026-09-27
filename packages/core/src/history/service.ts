import {
  animeAiringState,
  animeMetadata,
  Database,
  watchHistory,
} from "@animekaiser/db"
import type {
  AnimeLibraryMetadata,
  ContinueWatchingItem,
  StreamAudio,
  StreamProviderId,
  WatchHistoryNext,
  WatchHistoryShow,
  WatchHistoryStatus,
} from "@animekaiser/domain"
import { and, desc, eq, inArray, max, sql } from "drizzle-orm"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { AnimeService } from "../anime"

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

// The newest entry decides what to offer: an unfinished episode resumes;
// otherwise the following episode, unless it has not aired or does not exist.
export const nextForShow = (input: {
  latestEpisode: number
  latestStatus: WatchHistoryStatus
  totalEpisodes: number | null
  latestAiredEpisode: number | null
  nextAiringAt: Date | null
}): WatchHistoryNext => {
  if (input.latestStatus === "watching") {
    return { _tag: "resume", episode: input.latestEpisode }
  }
  const next = input.latestEpisode + 1
  if (input.totalEpisodes !== null && next > input.totalEpisodes) {
    return { _tag: "completed" }
  }
  if (input.latestAiredEpisode !== null && next > input.latestAiredEpisode) {
    return { _tag: "caughtUp", nextAiringAt: input.nextAiringAt }
  }
  return { _tag: "next", episode: next }
}

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
    dependencies: [AnimeService.Default],
    effect: Effect.gen(function* () {
      const database = yield* Database
      const animeService = yield* AnimeService

      const withEpisodeImages = (
        items: ReadonlyArray<Omit<ContinueWatchingItem, "episodeImage">>
      ) =>
        Effect.forEach(
          items,
          (item) =>
            animeService.getEpisodeMetadata(item.malId).pipe(
              Effect.map(
                (artwork): ContinueWatchingItem => ({
                  ...item,
                  episodeImage:
                    artwork.find((entry) => entry.number === item.episode)
                      ?.image ?? null,
                })
              )
            ),
          { concurrency: 4 }
        )

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

      const listForAnime = Effect.fn("WatchHistoryService.listForAnime")(
        function* (userId: string, malId: number) {
          const rows = yield* database
            .execute((db) =>
              db
                .select()
                .from(watchHistory)
                .where(
                  and(
                    eq(watchHistory.userId, userId),
                    eq(watchHistory.malId, malId)
                  )
                )
                .orderBy(watchHistory.episode)
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

          return rows.map(toEntry)
        }
      )

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

        return yield* withEpisodeImages(
          rows.map((row) => ({
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
          }))
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
            items: yield* withEpisodeImages(
              rows.slice(0, perPage).map((row) => ({
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
              }))
            ),
            hasNextPage,
          }
        }
      )

      const listHistoryShows = Effect.fn(
        "WatchHistoryService.listHistoryShows"
      )(function* (
        userId: string,
        page: number,
        perPage: number,
        query?: string
      ) {
        const search = query?.trim()
        const searchFilter = search
          ? sql`(${animeMetadata.titleRomaji} ilike ${`%${search}%`} or coalesce(${animeMetadata.titleEnglish}, '') ilike ${`%${search}%`})`
          : undefined
        const fail = (message: string) => (cause: unknown) =>
          new WatchHistoryServiceError({ message, cause })

        const lastWatched = max(watchHistory.updatedAt)
        const shows = yield* database
          .execute((db) =>
            db
              .select({ malId: watchHistory.malId, lastWatched })
              .from(watchHistory)
              .innerJoin(
                animeMetadata,
                eq(watchHistory.malId, animeMetadata.malId)
              )
              .where(and(eq(watchHistory.userId, userId), searchFilter))
              .groupBy(watchHistory.malId)
              .orderBy(desc(lastWatched), desc(watchHistory.malId))
              .limit(perPage + 1)
              .offset((page - 1) * perPage)
          )
          .pipe(Effect.mapError(fail("Unable to load watch history.")))

        const pageShows = shows.slice(0, perPage)
        const malIds = pageShows.map((show) => show.malId)
        if (malIds.length === 0) return { items: [], hasNextPage: false }

        const rows = yield* database
          .execute((db) =>
            db
              .select({
                history: watchHistory,
                anime: animeMetadata,
                airing: animeAiringState,
              })
              .from(watchHistory)
              .innerJoin(
                animeMetadata,
                eq(watchHistory.malId, animeMetadata.malId)
              )
              .leftJoin(
                animeAiringState,
                eq(animeAiringState.malId, watchHistory.malId)
              )
              .where(
                and(
                  eq(watchHistory.userId, userId),
                  inArray(watchHistory.malId, malIds)
                )
              )
              .orderBy(desc(watchHistory.episode))
          )
          .pipe(Effect.mapError(fail("Unable to load watch history.")))

        const items = yield* Effect.forEach(
          pageShows,
          (show) =>
            Effect.gen(function* () {
              const showRows = rows.filter(
                (row) => row.history.malId === show.malId
              )
              const first = showRows[0]
              if (!first) return []
              const anime: AnimeLibraryMetadata = {
                malId: first.anime.malId,
                aniListId: first.anime.aniListId,
                title: {
                  romaji: first.anime.titleRomaji,
                  english: first.anime.titleEnglish,
                },
                coverImage: first.anime.coverImage,
                episodes: first.anime.episodes,
              }
              const episodes = yield* withEpisodeImages(
                showRows.map((row) => ({ ...toEntry(row.history), anime }))
              )
              const latest = episodes.reduce((newest, item) =>
                item.updatedAt > newest.updatedAt ? item : newest
              )
              return [
                {
                  anime,
                  episodesWatched: episodes.length,
                  latest,
                  episodes,
                  next: nextForShow({
                    latestEpisode: latest.episode,
                    latestStatus: latest.status,
                    totalEpisodes:
                      first.airing?.totalEpisodes ?? first.anime.episodes,
                    latestAiredEpisode:
                      first.airing?.latestAiredEpisode ?? null,
                    nextAiringAt: first.airing?.nextAiringAt ?? null,
                  }),
                } satisfies WatchHistoryShow,
              ]
            }),
          { concurrency: 4 }
        )

        return { items: items.flat(), hasNextPage: shows.length > perPage }
      })

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
        listForAnime,
        listContinueWatching,
        listHistory,
        listHistoryShows,
        clearForAnime,
        clearAll,
      }
    }),
  }
) {}
