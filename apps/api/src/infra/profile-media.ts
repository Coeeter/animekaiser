import { ProfileMediaStorage } from "@animekaiser/core"
import { ProfileOperationError } from "@animekaiser/domain"
import { S3Client } from "bun"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import { Env } from "../env"

export const ProfileMediaStorageLive = Layer.effect(
  ProfileMediaStorage,
  Effect.gen(function* () {
    const env = yield* Env
    const publicBase = env.r2.publicUrl.replace(/\/$/, "")
    const client = new S3Client({
      endpoint: env.r2.endpoint,
      bucket: env.r2.bucket,
      accessKeyId: Redacted.value(env.r2.accessKeyId),
      secretAccessKey: Redacted.value(env.r2.secretAccessKey),
    })
    const storageError = () =>
      new ProfileOperationError({ message: "Profile image storage failed." })

    return ProfileMediaStorage.of({
      presign: (key, contentType) =>
        Effect.try({
          try: () =>
            client.presign(key, {
              method: "PUT",
              type: contentType,
              expiresIn: 5 * 60,
            }),
          catch: storageError,
        }),
      stat: (key) =>
        Effect.tryPromise({ try: () => client.stat(key), catch: storageError }),
      remove: (key) =>
        key
          ? Effect.tryPromise({
              try: () => client.delete(key),
              catch: storageError,
            })
          : Effect.void,
      publicUrl: (key) => `${publicBase}/${key}`,
      keyFromUrl: (url) =>
        url?.startsWith(`${publicBase}/`)
          ? url.slice(publicBase.length + 1)
          : null,
    })
  })
)
