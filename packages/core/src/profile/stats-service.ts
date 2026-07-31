import {
  animeMetadata,
  Database,
  libraryStatuses,
  userLibraryEntry,
  watchHistory,
} from "@animekaiser/db"
import type {
  ActivityDay,
  LibraryStatus,
  ProfileStats,
  ScoreBucket,
  TopRatedTitle,
} from "@animekaiser/domain"
import { and, desc, eq, isNotNull, sql } from "drizzle-orm"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

export class ProfileStatsServiceError extends Schema.TaggedError<ProfileStatsServiceError>()(
  "ProfileStatsServiceError",
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}

const nominalEpisodeMinutes = 24

const activityWindowDays = 182

const isoDate = (value: Date) => value.toISOString().slice(0, 10)

const emptyStatusCounts = () =>
  Object.fromEntries(libraryStatuses.map((status) => [status, 0])) as Record<
    LibraryStatus,
    number
  >

export const calculateStreaks = (
  days: ReadonlySet<string>,
  today: Date
): { current: number; longest: number } => {
  if (days.size === 0) return { current: 0, longest: 0 }

  const sorted = Array.from(days).sort()
  let longest = 1
  let run = 1

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(`${sorted[index - 1]}T00:00:00Z`)
    const current = new Date(`${sorted[index]}T00:00:00Z`)
    const gapDays = Math.round(
      (current.getTime() - previous.getTime()) / 86_400_000
    )

    run = gapDays === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
  }

  const todayIso = isoDate(today)
  const yesterday = new Date(today.getTime() - 86_400_000)
  const latest = sorted[sorted.length - 1]
  const streakIsLive = latest === todayIso || latest === isoDate(yesterday)

  return { current: streakIsLive ? run : 0, longest }
}

export const scoreBucket = (score: number) =>
  Math.min(10, Math.max(1, Math.round(score / 10)))

export class ProfileStatsService extends Effect.Service<ProfileStatsService>()(
  "@animekaiser/core/ProfileStatsService",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const database = yield* Database

      const failWith = (message: string) => (cause: unknown) =>
        new ProfileStatsServiceError({ message, cause })

      const forUser = Effect.fn("ProfileStatsService.forUser")(function* (
        userId: string
      ) {
        const [entries, scored, historyRows, topRatedRows] = yield* Effect.all(
          [
            database
              .execute((db) =>
                db
                  .select({
                    status: userLibraryEntry.status,
                    progress: userLibraryEntry.progress,
                    score: userLibraryEntry.score,
                  })
                  .from(userLibraryEntry)
                  .where(eq(userLibraryEntry.userId, userId))
              )
              .pipe(Effect.mapError(failWith("Unable to load library stats."))),

            database
              .execute((db) =>
                db
                  .select({ score: userLibraryEntry.score })
                  .from(userLibraryEntry)
                  .where(
                    and(
                      eq(userLibraryEntry.userId, userId),
                      isNotNull(userLibraryEntry.score)
                    )
                  )
              )
              .pipe(Effect.mapError(failWith("Unable to load score stats."))),

            database
              .execute((db) =>
                db
                  .select({
                    malId: watchHistory.malId,
                    positionSeconds: watchHistory.positionSeconds,
                    durationSeconds: watchHistory.durationSeconds,
                    updatedAt: watchHistory.updatedAt,
                  })
                  .from(watchHistory)
                  .where(eq(watchHistory.userId, userId))
              )
              .pipe(Effect.mapError(failWith("Unable to load watch history."))),

            database
              .execute((db) =>
                db
                  .select({
                    malId: userLibraryEntry.malId,
                    score: userLibraryEntry.score,
                    titleRomaji: animeMetadata.titleRomaji,
                    titleEnglish: animeMetadata.titleEnglish,
                    coverImage: animeMetadata.coverImage,
                  })
                  .from(userLibraryEntry)
                  .innerJoin(
                    animeMetadata,
                    eq(userLibraryEntry.malId, animeMetadata.malId)
                  )
                  .where(
                    and(
                      eq(userLibraryEntry.userId, userId),
                      isNotNull(userLibraryEntry.score)
                    )
                  )
                  .orderBy(
                    sql`${userLibraryEntry.score} desc nulls last`,
                    desc(userLibraryEntry.updatedAt)
                  )
                  .limit(8)
              )
              .pipe(Effect.mapError(failWith("Unable to load top titles."))),
          ],
          { concurrency: 4 }
        )

        const byStatus = emptyStatusCounts()
        let episodesWatched = 0

        for (const entry of entries) {
          byStatus[entry.status] += 1
          episodesWatched += entry.progress
        }

        const scores = scored
          .map((row) => row.score)
          .filter((score): score is number => score !== null)

        const scoreTotals = new Map<number, number>()
        for (const score of scores) {
          const bucket = scoreBucket(score)
          scoreTotals.set(bucket, (scoreTotals.get(bucket) ?? 0) + 1)
        }

        const scoreDistribution: Array<ScoreBucket> = Array.from(
          { length: 10 },
          (_, index) => ({
            score: index + 1,
            count: scoreTotals.get(index + 1) ?? 0,
          })
        )

        const meanScore =
          scores.length === 0
            ? null
            : Math.round(
                scores.reduce((total, score) => total + score, 0) /
                  scores.length
              )

        let trackedSeconds = 0
        const activeDays = new Set<string>()
        const activityByDay = new Map<string, number>()
        const startedTitles = new Set<number>()

        const todayUtc = new Date(`${isoDate(new Date())}T00:00:00Z`)
        const windowStart = new Date(
          todayUtc.getTime() -
            (activityWindowDays - 1 + todayUtc.getUTCDay()) * 86_400_000
        )

        for (const row of historyRows) {
          const capped =
            row.durationSeconds && row.durationSeconds > 0
              ? Math.min(row.positionSeconds, row.durationSeconds)
              : row.positionSeconds

          trackedSeconds += Math.max(0, capped)
          startedTitles.add(row.malId)

          const day = isoDate(row.updatedAt)
          activeDays.add(day)

          if (row.updatedAt >= windowStart) {
            activityByDay.set(day, (activityByDay.get(day) ?? 0) + 1)
          }
        }

        const activityDayCount =
          Math.round(
            (todayUtc.getTime() - windowStart.getTime()) / 86_400_000
          ) + 1

        const activity: Array<ActivityDay> = Array.from(
          { length: activityDayCount },
          (_, index) => {
            const date = isoDate(
              new Date(windowStart.getTime() + index * 86_400_000)
            )
            return { date, episodes: activityByDay.get(date) ?? 0 }
          }
        )

        const streaks = calculateStreaks(activeDays, new Date())

        const topRated: Array<TopRatedTitle> = topRatedRows.flatMap((row) =>
          row.score === null
            ? []
            : [
                {
                  malId: row.malId,
                  title: row.titleEnglish ?? row.titleRomaji,
                  coverImage: row.coverImage,
                  score: row.score,
                },
              ]
        )

        const trackedMinutes = Math.round(trackedSeconds / 60)

        return {
          totalTitles: entries.length,
          byStatus,
          meanScore,
          scoredCount: scores.length,
          scoreDistribution,
          episodesWatched,
          estimatedMinutes: episodesWatched * nominalEpisodeMinutes,
          trackedMinutes,
          episodesPlayed: historyRows.length,
          titlesStarted: startedTitles.size,
          currentStreakDays: streaks.current,
          longestStreakDays: streaks.longest,
          activity,
          topRated,
        } satisfies ProfileStats
      })

      return { forUser }
    }),
  }
) {}
