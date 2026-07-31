import * as Schema from "effect/Schema"
import { MalId } from "../anime/models"
import { LibraryStatus } from "../library/models"

export const ScoreBucket = Schema.Struct({
  score: Schema.Int.pipe(Schema.between(1, 10)),
  count: Schema.NonNegativeInt,
})
export type ScoreBucket = typeof ScoreBucket.Type

export const ActivityDay = Schema.Struct({
  date: Schema.String,
  episodes: Schema.NonNegativeInt,
})
export type ActivityDay = typeof ActivityDay.Type

export const TopRatedTitle = Schema.Struct({
  malId: MalId,
  title: Schema.String,
  coverImage: Schema.NullOr(Schema.String),
  score: Schema.Int.pipe(Schema.between(0, 100)),
})
export type TopRatedTitle = typeof TopRatedTitle.Type

export const ProfileStats = Schema.Struct({
  totalTitles: Schema.NonNegativeInt,
  byStatus: Schema.Record({ key: LibraryStatus, value: Schema.NonNegativeInt }),
  meanScore: Schema.NullOr(Schema.Int.pipe(Schema.between(0, 100))),
  scoredCount: Schema.NonNegativeInt,
  scoreDistribution: Schema.Array(ScoreBucket),

  episodesWatched: Schema.NonNegativeInt,
  estimatedMinutes: Schema.NonNegativeInt,
  trackedMinutes: Schema.NonNegativeInt,

  episodesPlayed: Schema.NonNegativeInt,
  titlesStarted: Schema.NonNegativeInt,
  currentStreakDays: Schema.NonNegativeInt,
  longestStreakDays: Schema.NonNegativeInt,
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
