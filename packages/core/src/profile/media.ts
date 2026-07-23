import type {
  ProfileImageContentType,
  ProfileImageKind,
} from "@workspace/domain"
import { ProfileOperationError } from "@workspace/domain"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { ProfileService } from "./service"

const maxImageSize = 5 * 1024 * 1024
const extension = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const

export const isValidProfileImageSize = (size: number) =>
  Number.isInteger(size) && size >= 1 && size <= maxImageSize

export const isValidProfileImage = (object: { size: number; type: string }) =>
  isValidProfileImageSize(object.size) && Object.hasOwn(extension, object.type)

export type ProfileMediaStorageShape = {
  presign: (
    key: string,
    contentType: ProfileImageContentType
  ) => Effect.Effect<string, ProfileOperationError>
  stat: (
    key: string
  ) => Effect.Effect<{ size: number; type: string }, ProfileOperationError>
  remove: (key: string | null) => Effect.Effect<void, ProfileOperationError>
  publicUrl: (key: string) => string
  keyFromUrl: (url: string | null | undefined) => string | null
}

export class ProfileMediaStorage extends Context.Tag(
  "@workspace/core/ProfileMediaStorage"
)<ProfileMediaStorage, ProfileMediaStorageShape>() {}

export class ProfileMediaService extends Effect.Service<ProfileMediaService>()(
  "@workspace/core/ProfileMediaService",
  {
    accessors: true,
    dependencies: [ProfileService.Default],
    effect: Effect.gen(function* () {
      const storage = yield* ProfileMediaStorage

      const createUpload = Effect.fn("ProfileMediaService.createUpload")(
        function* (
          userId: string,
          kind: ProfileImageKind,
          contentType: ProfileImageContentType,
          size: number
        ) {
          if (!isValidProfileImageSize(size)) {
            return yield* new ProfileOperationError({
              message: "Upload an image up to 5 MB.",
            })
          }
          const key = `${kind}s/${userId}/${crypto.randomUUID()}.${extension[contentType]}`
          return { key, uploadUrl: yield* storage.presign(key, contentType) }
        }
      )

      const verifyUpload = Effect.fn("ProfileMediaService.verifyUpload")(
        function* (userId: string, kind: ProfileImageKind, key: string) {
          if (!key.startsWith(`${kind}s/${userId}/`)) {
            return yield* new ProfileOperationError({
              message: "Invalid profile image upload.",
            })
          }
          const object = yield* storage.stat(key)
          if (!isValidProfileImage(object)) {
            yield* storage.remove(key)
            return yield* new ProfileOperationError({
              message: "Upload a JPEG, PNG, or WebP image up to 5 MB.",
            })
          }
          return storage.publicUrl(key)
        }
      )

      const setBanner = Effect.fn("ProfileMediaService.setBanner")(function* (
        userId: string,
        key: string
      ) {
        const current = yield* ProfileService.getOwnProfile(userId)
        const publicUrl = yield* verifyUpload(userId, "banner", key)
        yield* ProfileService.setBannerKey(userId, key)
        yield* storage.remove(current.profile.bannerKey)
        return publicUrl
      })

      const removeBanner = Effect.fn("ProfileMediaService.removeBanner")(
        function* (userId: string) {
          const current = yield* ProfileService.getOwnProfile(userId)
          yield* ProfileService.setBannerKey(userId, null)
          yield* storage.remove(current.profile.bannerKey)
        }
      )

      return {
        createUpload,
        verifyUpload,
        setBanner,
        removeBanner,
        remove: storage.remove,
        keyFromUrl: storage.keyFromUrl,
      }
    }),
  }
) {}
