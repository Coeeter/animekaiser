import * as Schema from "effect/Schema"
import { MalId } from "../anime/models"
import { LibraryStatus } from "../library/models"

export const ScoreBucket = Schema.Struct({
  score: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 10 })),
  count: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
})
export type ScoreBucket = typeof ScoreBucket.Type

export const ActivityDay = Schema.Struct({
  date: Schema.String,
  episodes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
})
export type ActivityDay = typeof ActivityDay.Type

export const TopRatedTitle = Schema.Struct({
  malId: MalId,
  title: Schema.String,
  coverImage: Schema.NullOr(Schema.String),
  score: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 100 })),
})
export type TopRatedTitle = typeof TopRatedTitle.Type

export const ProfileStats = Schema.Struct({
  totalTitles: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  byStatus: Schema.Record(
    LibraryStatus,
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  meanScore: Schema.NullOr(
    Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 100 }))
  ),
  scoredCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  scoreDistribution: Schema.Array(ScoreBucket),

  episodesWatched: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  estimatedMinutes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  trackedMinutes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),

  episodesPlayed: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  titlesStarted: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  currentStreakDays: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  longestStreakDays: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  activity: Schema.Array(ActivityDay),

  topRated: Schema.Array(TopRatedTitle),
})
export type ProfileStats = typeof ProfileStats.Type

export const ProfileLibraryStats = Schema.Struct({
  totalTitles: ProfileStats.fields.totalTitles,
  byStatus: ProfileStats.fields.byStatus,
  meanScore: ProfileStats.fields.meanScore,
  scoredCount: ProfileStats.fields.scoredCount,
  scoreDistribution: ProfileStats.fields.scoreDistribution,
  episodesWatched: ProfileStats.fields.episodesWatched,
  estimatedMinutes: ProfileStats.fields.estimatedMinutes,
  topRated: ProfileStats.fields.topRated,
})
export type ProfileLibraryStats = typeof ProfileLibraryStats.Type

export const ProfileActivityStats = Schema.Struct({
  trackedMinutes: ProfileStats.fields.trackedMinutes,
  episodesPlayed: ProfileStats.fields.episodesPlayed,
  titlesStarted: ProfileStats.fields.titlesStarted,
  currentStreakDays: ProfileStats.fields.currentStreakDays,
  longestStreakDays: ProfileStats.fields.longestStreakDays,
  activity: ProfileStats.fields.activity,
})
export type ProfileActivityStats = typeof ProfileActivityStats.Type

export const PublicProfileStats = Schema.Struct({
  stats: Schema.NullOr(ProfileLibraryStats),
  activity: Schema.NullOr(ProfileActivityStats),
})
export type PublicProfileStats = typeof PublicProfileStats.Type
