import { AuthServer } from "@animekaiser/auth/server"
import type { ProfileRecord } from "@animekaiser/core"
import {
  ProfileMediaService,
  ProfileService,
  ProfileStatsService,
} from "@animekaiser/core"
import {
  CurrentUser,
  OptionalCurrentUser,
  ProfileOperationError,
  ProfileRpcs,
} from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { RpcServerConfig } from "./config"

const profileView = (record: ProfileRecord, publicUrl: string) => ({
  user: { username: record.user.username, image: record.user.image },
  profile: {
    bannerUrl: record.profile.bannerKey
      ? `${publicUrl.replace(/\/$/, "")}/${record.profile.bannerKey}`
      : null,
    description: record.profile.description,
    private: record.profile.private,
    shareStats: record.profile.shareStats,
    shareActivity: record.profile.shareActivity,
    shareList: record.profile.shareList,
  },
})

export const ProfileHandlersLive = ProfileRpcs.toLayer(
  Effect.gen(function* () {
    const config = yield* RpcServerConfig
    const auth = yield* AuthServer
    const authHeaders = (headers: Readonly<Record<string, string>>) =>
      new globalThis.Headers(headers)

    return ProfileRpcs.of({
      GetOwnProfile: () =>
        Effect.gen(function* () {
          const current = yield* CurrentUser
          return profileView(
            yield* ProfileService.getOwnProfile(current.id),
            config.mediaPublicUrl
          )
        }),
      GetPublicProfile: ({ username, asPublic }) =>
        Effect.gen(function* () {
          const current = yield* OptionalCurrentUser
          const result = yield* ProfileService.getPublicProfile(username)
          return Option.match(result, {
            onNone: () => ({ type: "not_found" as const }),
            onSome: (record) => {
              const view = profileView(record, config.mediaPublicUrl)
              const isOwner = !asPublic && current?.id === record.user.id
              return record.profile.private && !isOwner
                ? { type: "private" as const, user: view.user }
                : { type: "public" as const, ...view }
            },
          })
        }),
      GetOwnProfileStats: () =>
        Effect.gen(function* () {
          const current = yield* CurrentUser
          return yield* ProfileStatsService.forUser(current.id).pipe(
            Effect.catchTag("ProfileStatsServiceError", (error) =>
              Effect.fail(new ProfileOperationError({ message: error.message }))
            )
          )
        }),
      GetPublicProfileStats: ({ username, asPublic }) =>
        Effect.gen(function* () {
          const current = yield* OptionalCurrentUser
          const result = yield* ProfileService.getPublicProfile(username)

          return yield* Option.match(result, {
            onNone: () => Effect.succeed(null),
            onSome: (record) => {
              const isOwner = !asPublic && current?.id === record.user.id
              if (record.profile.private && !isOwner) {
                return Effect.succeed(null)
              }

              const shareStats = isOwner || record.profile.shareStats
              const shareActivity = isOwner || record.profile.shareActivity
              if (!shareStats && !shareActivity) return Effect.succeed(null)

              return ProfileStatsService.forUser(record.user.id).pipe(
                Effect.map((stats) => ({
                  stats: shareStats
                    ? {
                        totalTitles: stats.totalTitles,
                        byStatus: stats.byStatus,
                        meanScore: stats.meanScore,
                        scoredCount: stats.scoredCount,
                        scoreDistribution: stats.scoreDistribution,
                        episodesWatched: stats.episodesWatched,
                        estimatedMinutes: stats.estimatedMinutes,
                        topRated: stats.topRated,
                      }
                    : null,
                  activity: shareActivity
                    ? {
                        trackedMinutes: stats.trackedMinutes,
                        episodesPlayed: stats.episodesPlayed,
                        titlesStarted: stats.titlesStarted,
                        currentStreakDays: stats.currentStreakDays,
                        longestStreakDays: stats.longestStreakDays,
                        activity: stats.activity,
                      }
                    : null,
                })),
                Effect.catchTag("ProfileStatsServiceError", (error) =>
                  Effect.fail(
                    new ProfileOperationError({ message: error.message })
                  )
                )
              )
            },
          })
        }),
      UpdateProfile: ({ description }) =>
        Effect.gen(function* () {
          const current = yield* CurrentUser
          const normalized = description?.trim() || null
          if (normalized && normalized.length > 300) {
            return yield* new ProfileOperationError({
              message: "Profile description must be 300 characters or less.",
            })
          }
          return profileView(
            yield* ProfileService.updateDescription(current.id, normalized),
            config.mediaPublicUrl
          )
        }),
      UpdatePrivacy: (patch) =>
        Effect.gen(function* () {
          const current = yield* CurrentUser
          return profileView(
            yield* ProfileService.updatePrivacy(current.id, patch),
            config.mediaPublicUrl
          )
        }),
      CreateProfileImageUpload: ({ kind, contentType, size }) =>
        Effect.gen(function* () {
          const current = yield* CurrentUser
          return yield* ProfileMediaService.createUpload(
            current.id,
            kind,
            contentType,
            size
          )
        }),
      CompleteProfileImageUpload: ({ kind, key }, options) =>
        Effect.gen(function* () {
          const current = yield* CurrentUser
          if (kind === "avatar") {
            const publicUrl = yield* ProfileMediaService.verifyUpload(
              current.id,
              kind,
              key
            )
            yield* Effect.tryPromise({
              try: () =>
                auth.api.updateUser({
                  headers: authHeaders(options.headers),
                  body: { image: publicUrl },
                }),
              catch: () =>
                new ProfileOperationError({
                  message: "Unable to update profile picture.",
                }),
            }).pipe(Effect.tapError(() => ProfileMediaService.remove(key)))
            yield* ProfileMediaService.keyFromUrl(current.image).pipe(
              Effect.flatMap(ProfileMediaService.remove)
            )
          } else {
            yield* ProfileMediaService.setBanner(current.id, key)
          }
          return profileView(
            yield* ProfileService.getOwnProfile(current.id),
            config.mediaPublicUrl
          )
        }),
      RemoveProfileImage: ({ kind }, options) =>
        Effect.gen(function* () {
          const current = yield* CurrentUser
          if (kind === "avatar") {
            yield* Effect.tryPromise({
              try: () =>
                auth.api.updateUser({
                  headers: authHeaders(options.headers),
                  body: { image: null },
                }),
              catch: () =>
                new ProfileOperationError({
                  message: "Unable to remove profile picture.",
                }),
            })
            yield* ProfileMediaService.keyFromUrl(current.image).pipe(
              Effect.flatMap(ProfileMediaService.remove)
            )
          } else {
            yield* ProfileMediaService.removeBanner(current.id)
          }
          return profileView(
            yield* ProfileService.getOwnProfile(current.id),
            config.mediaPublicUrl
          )
        }),
      DeleteAccount: ({ password }, options) =>
        Effect.gen(function* () {
          if (!password) {
            return yield* new ProfileOperationError({
              message: "Password is required.",
            })
          }
          const user = yield* CurrentUser
          const current = yield* ProfileService.getOwnProfile(user.id)
          yield* Effect.tryPromise({
            try: () =>
              auth.api.deleteUser({
                headers: authHeaders(options.headers),
                body: { password, callbackURL: config.appUrl },
              }),
            catch: () =>
              new ProfileOperationError({
                message: "Unable to delete account. Check your password.",
              }),
          })
          yield* Effect.all(
            [
              ProfileMediaService.keyFromUrl(user.image).pipe(
                Effect.flatMap(ProfileMediaService.remove)
              ),
              ProfileMediaService.remove(current.profile.bannerKey),
            ],
            { concurrency: 2 }
          ).pipe(
            Effect.catchTag("ProfileOperationError", (error) =>
              Effect.logWarning(error.message)
            )
          )
        }),
    })
  })
).pipe(
  Layer.provide(
    Layer.mergeAll(
      ProfileMediaService.Default,
      ProfileService.Default,
      ProfileStatsService.Default
    )
  )
)
