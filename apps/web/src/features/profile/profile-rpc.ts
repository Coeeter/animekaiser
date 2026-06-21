import { ProfileImageContentType } from "@workspace/domain"
import { KaiserRpcClient } from "@workspace/rpc/client"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Effect from "effect/Effect"
import { runRpc } from "../../lib/rpc-client"

export const loadOwnProfile = () =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.GetOwnProfile()
    })
  )

export const saveProfile = (description: string | null) =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.UpdateProfile({ description })
    })
  )

export const savePrivacy = (isPrivate: boolean) =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.UpdatePrivacy({ private: isPrivate })
    })
  )

export const uploadProfileImage = async (
  kind: "avatar" | "banner",
  file: File
) => {
  const contentType = Schema.decodeUnknownOption(ProfileImageContentType)(
    file.type
  ).pipe(
    Option.getOrThrowWith(() => new Error("Unsupported image type."))
  )
  const upload = await runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.CreateProfileImageUpload({
        kind,
        contentType,
        size: file.size,
      })
    })
  )
  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: file,
  })
  if (!response.ok) throw new Error("Unable to upload image.")
  return runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.CompleteProfileImageUpload({
        kind,
        key: upload.key,
      })
    })
  )
}

export const removeProfileImage = (kind: "avatar" | "banner") =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.RemoveProfileImage({ kind })
    })
  )

export const deleteAccount = (password: string) =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.DeleteAccount({ password })
    })
  )
