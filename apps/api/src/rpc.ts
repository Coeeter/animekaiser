import { RpcSerialization, RpcServer } from "@effect/rpc"
import {
  ExternalListAccountsService,
  ProfileMediaService,
  ProfileService,
} from "@workspace/core/server"
import type { ProfileRecord } from "@workspace/core/server"
import {
  AuthenticationRequiredError,
  ExternalListOperationError,
  KaiserRpcs,
  ProfileOperationError,
} from "@workspace/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { BetterAuth } from "./auth"
import { Env } from "./env"

const profileView = (record: ProfileRecord, publicUrl: string) => ({
  user: {
    username: record.user.username,
    image: record.user.image,
  },
  profile: {
    bannerUrl: record.profile.bannerKey
      ? `${publicUrl.replace(/\/$/, "")}/${record.profile.bannerKey}`
      : null,
    description: record.profile.description,
    private: record.profile.private,
  },
})

const mapExternalListError = (error: { message: string }) =>
  new ExternalListOperationError({ message: error.message })

const RpcServicesLive = Layer.mergeAll(
  ExternalListAccountsService.Default,
  ProfileMediaService.Default,
  ProfileService.Default
)

const HandlersLive = KaiserRpcs.toLayer(
  Effect.gen(function* () {
    const auth = yield* BetterAuth
    const env = yield* Env

    const sessionFromHeaders = (headers: Readonly<Record<string, string>>) =>
      Effect.tryPromise({
        try: () =>
          auth.api.getSession({ headers: new globalThis.Headers(headers) }),
        catch: () =>
          new AuthenticationRequiredError({
            message: "Authentication request could not be read.",
          }),
      })

    const requireSessionFromHeaders = (headers: Record<string, string>) =>
      Effect.gen(function* () {
        const session = yield* sessionFromHeaders(headers)
        return yield* session
          ? Effect.succeed(session)
          : new AuthenticationRequiredError({
              message: "Authentication is required.",
            })
      })

    const userFromHeaders = (headers: Record<string, string>) =>
      requireSessionFromHeaders(headers).pipe(
        Effect.map((session) => session.user)
      )

    const authHeaders = (headers: Readonly<Record<string, string>>) =>
      new globalThis.Headers(headers)

    return KaiserRpcs.of({
      Ping: () => Effect.succeed("pong" as const),
      GetOwnProfile: (_, options) =>
        Effect.gen(function* () {
          const current = yield* userFromHeaders(options.headers)
          const result = yield* ProfileService.getOwnProfile(current.id)
          return profileView(result, env.r2.publicUrl)
        }),
      GetPublicProfile: ({ username }, options) =>
        Effect.gen(function* () {
          const session = yield* sessionFromHeaders(options.headers).pipe(
            Effect.catchTag("AuthenticationRequiredError", () =>
              Effect.succeed(null)
            )
          )
          const result = yield* ProfileService.getPublicProfile(username)
          return Option.match(result, {
            onNone: () => ({ type: "not_found" as const }),
            onSome: (record) => {
              const view = profileView(record, env.r2.publicUrl)
              return record.profile.private &&
                session?.user.id !== record.user.id
                ? { type: "private" as const, user: view.user }
                : { type: "public" as const, ...view }
            },
          })
        }),
      UpdateProfile: ({ description }, options) =>
        Effect.gen(function* () {
          const current = yield* userFromHeaders(options.headers)
          const normalized = description?.trim() || null
          if (normalized && normalized.length > 300) {
            return yield* new ProfileOperationError({
              message: "Profile description must be 300 characters or less.",
            })
          }
          const result = yield* ProfileService.updateDescription(
            current.id,
            normalized
          )
          return profileView(result, env.r2.publicUrl)
        }),
      UpdatePrivacy: ({ private: isPrivate }, options) =>
        Effect.gen(function* () {
          const current = yield* userFromHeaders(options.headers)
          const result = yield* ProfileService.updatePrivacy(
            current.id,
            isPrivate
          )
          return profileView(result, env.r2.publicUrl)
        }),
      CreateProfileImageUpload: ({ kind, contentType, size }, options) =>
        Effect.gen(function* () {
          const current = yield* userFromHeaders(options.headers)
          return yield* ProfileMediaService.createUpload(
            current.id,
            kind,
            contentType,
            size
          )
        }),
      CompleteProfileImageUpload: ({ kind, key }, options) =>
        Effect.gen(function* () {
          const session = yield* requireSessionFromHeaders(options.headers)
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
                new ProfileOperationError({
                  message: "Unable to update profile picture.",
                }),
            }).pipe(Effect.tapError(() => ProfileMediaService.remove(key)))
            const previousKey = yield* ProfileMediaService.keyFromUrl(
              session.user.image
            )
            yield* ProfileMediaService.remove(previousKey)
          } else {
            yield* ProfileMediaService.setBanner(session.user.id, key)
          }
          return profileView(
            yield* ProfileService.getOwnProfile(session.user.id),
            env.r2.publicUrl
          )
        }),
      RemoveProfileImage: ({ kind }, options) =>
        Effect.gen(function* () {
          const session = yield* requireSessionFromHeaders(options.headers)
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
            const previousKey = yield* ProfileMediaService.keyFromUrl(
              session.user.image
            )
            yield* ProfileMediaService.remove(previousKey)
          } else {
            yield* ProfileMediaService.removeBanner(session.user.id)
          }
          return profileView(
            yield* ProfileService.getOwnProfile(session.user.id),
            env.r2.publicUrl
          )
        }),
      DeleteAccount: ({ password }, options) =>
        Effect.gen(function* () {
          if (!password) {
            return yield* new ProfileOperationError({
              message: "Password is required.",
            })
          }
          const session = yield* requireSessionFromHeaders(options.headers)
          const current = yield* ProfileService.getOwnProfile(session.user.id)
          yield* Effect.tryPromise({
            try: () =>
              auth.api.deleteUser({
                headers: authHeaders(options.headers),
                body: { password, callbackURL: env.app.url },
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
      ListExternalListAccounts: (_, options) =>
        Effect.gen(function* () {
          const current = yield* userFromHeaders(options.headers)
          return yield* ExternalListAccountsService.listAccounts(current.id)
        }).pipe(
          Effect.catchTag("ExternalListAccountError", (error) =>
            Effect.fail(mapExternalListError(error))
          )
        ),
      DisconnectExternalListAccount: ({ provider }, options) =>
        Effect.gen(function* () {
          const current = yield* userFromHeaders(options.headers)
          yield* ExternalListAccountsService.disconnectAccount(
            current.id,
            provider
          )
        }).pipe(
          Effect.catchTag("ExternalListAccountError", (error) =>
            Effect.fail(mapExternalListError(error))
          )
        ),
      StartLibraryImport: ({ provider }, options) =>
        Effect.gen(function* () {
          const current = yield* userFromHeaders(options.headers)
          return yield* ExternalListAccountsService.startImport(
            current.id,
            provider
          )
        }).pipe(
          Effect.catchTag("ExternalListAccountError", (error) =>
            Effect.fail(mapExternalListError(error))
          )
        ),
    })
  })
).pipe(Layer.provide(RpcServicesLive))

export const RpcLive = RpcServer.layerHttpRouter({
  group: KaiserRpcs,
  path: "/rpc",
  protocol: "http",
}).pipe(
  Layer.provide(HandlersLive),
  Layer.provide(RpcSerialization.layerNdjson)
)
