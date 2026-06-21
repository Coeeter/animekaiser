import {
  ProfileMediaService,
  ProfileService,
} from "@workspace/core/server"
import type { ProfileRecord } from "@workspace/core/server"
import { ProfileOperationError, ProfileRpcs } from "@workspace/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { RpcServerConfig } from "./config"
import { RpcSession } from "./session"

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
    const sessionService = yield* RpcSession
    const config = yield* RpcServerConfig
    const { auth } = sessionService
    const authHeaders = (headers: Readonly<Record<string, string>>) =>
      new globalThis.Headers(headers)

    return ProfileRpcs.of({
      GetOwnProfile: (_, options) =>
        Effect.gen(function* () {
          const current = yield* sessionService.requireUser(options.headers)
          return profileView(
            yield* ProfileService.getOwnProfile(current.id),
            config.mediaPublicUrl
          )
        }),
      GetPublicProfile: ({ username }, options) =>
        Effect.gen(function* () {
          const session = yield* sessionService.fromHeaders(options.headers).pipe(
            Effect.catchTag("AuthenticationRequiredError", () => Effect.succeed(null))
          )
          const result = yield* ProfileService.getPublicProfile(username)
          return Option.match(result, {
            onNone: () => ({ type: "not_found" as const }),
            onSome: (record) => {
              const view = profileView(record, config.mediaPublicUrl)
              return record.profile.private && session?.user.id !== record.user.id
                ? { type: "private" as const, user: view.user }
                : { type: "public" as const, ...view }
            },
          })
        }),
      UpdateProfile: ({ description }, options) =>
        Effect.gen(function* () {
          const current = yield* sessionService.requireUser(options.headers)
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
      UpdatePrivacy: ({ private: isPrivate }, options) =>
        Effect.gen(function* () {
          const current = yield* sessionService.requireUser(options.headers)
          return profileView(
            yield* ProfileService.updatePrivacy(current.id, isPrivate),
            config.mediaPublicUrl
          )
        }),
      CreateProfileImageUpload: ({ kind, contentType, size }, options) =>
        Effect.gen(function* () {
          const current = yield* sessionService.requireUser(options.headers)
          return yield* ProfileMediaService.createUpload(current.id, kind, contentType, size)
        }),
      CompleteProfileImageUpload: ({ kind, key }, options) =>
        Effect.gen(function* () {
          const session = yield* sessionService.requireSession(options.headers)
          if (kind === "avatar") {
            const publicUrl = yield* ProfileMediaService.verifyUpload(
              session.user.id,
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
                new ProfileOperationError({ message: "Unable to update profile picture." }),
            }).pipe(Effect.tapError(() => ProfileMediaService.remove(key)))
            yield* ProfileMediaService.keyFromUrl(session.user.image).pipe(
              Effect.flatMap(ProfileMediaService.remove)
            )
          } else {
            yield* ProfileMediaService.setBanner(session.user.id, key)
          }
          return profileView(
            yield* ProfileService.getOwnProfile(session.user.id),
            config.mediaPublicUrl
          )
        }),
      RemoveProfileImage: ({ kind }, options) =>
        Effect.gen(function* () {
          const session = yield* sessionService.requireSession(options.headers)
          if (kind === "avatar") {
            yield* Effect.tryPromise({
              try: () =>
                auth.api.updateUser({
                  headers: authHeaders(options.headers),
                  body: { image: null },
                }),
              catch: () =>
                new ProfileOperationError({ message: "Unable to remove profile picture." }),
            })
            yield* ProfileMediaService.keyFromUrl(session.user.image).pipe(
              Effect.flatMap(ProfileMediaService.remove)
            )
          } else {
            yield* ProfileMediaService.removeBanner(session.user.id)
          }
          return profileView(
            yield* ProfileService.getOwnProfile(session.user.id),
            config.mediaPublicUrl
          )
        }),
      DeleteAccount: ({ password }, options) =>
        Effect.gen(function* () {
          if (!password) {
            return yield* new ProfileOperationError({ message: "Password is required." })
          }
          const session = yield* sessionService.requireSession(options.headers)
          const current = yield* ProfileService.getOwnProfile(session.user.id)
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
              ProfileMediaService.keyFromUrl(session.user.image).pipe(
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
      RpcSession.Default,
      ProfileMediaService.Default,
      ProfileService.Default
    )
  )
)
