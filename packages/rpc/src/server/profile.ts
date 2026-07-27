import { AuthServer } from "@animekaiser/auth/server"
import type { ProfileRecord } from "@animekaiser/core"
import { ProfileMediaService, ProfileService } from "@animekaiser/core"
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
      GetPublicProfile: ({ username }) =>
        Effect.gen(function* () {
          const current = yield* OptionalCurrentUser
          const result = yield* ProfileService.getPublicProfile(username)
          return Option.match(result, {
            onNone: () => ({ type: "not_found" as const }),
            onSome: (record) => {
              const view = profileView(record, config.mediaPublicUrl)
              return record.profile.private && current?.id !== record.user.id
                ? { type: "private" as const, user: view.user }
                : { type: "public" as const, ...view }
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
      UpdatePrivacy: ({ private: isPrivate }) =>
        Effect.gen(function* () {
          const current = yield* CurrentUser
          return profileView(
            yield* ProfileService.updatePrivacy(current.id, isPrivate),
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
    Layer.mergeAll(ProfileMediaService.Default, ProfileService.Default)
  )
)
