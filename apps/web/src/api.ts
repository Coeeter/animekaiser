import { KaiserRpcClient } from "@workspace/domain"
import * as Effect from "effect/Effect"
import { runRpc } from "./rpc"

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
  const contentType =
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "image/webp"
      ? file.type
      : null
  if (!contentType) throw new Error("Unsupported image type.")
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
    headers: { "content-type": file.type },
    body: file,
  })
  if (!response.ok) throw new Error("Unable to upload image.")
  return runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.CompleteProfileImageUpload({ kind, key: upload.key })
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

export const loadExternalAccounts = () =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.ListExternalListAccounts()
    })
  )

export const disconnectExternalAccount = (provider: "mal" | "anilist") =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.DisconnectExternalListAccount({ provider })
    })
  )

export const startLibraryImport = (provider: "mal" | "anilist") =>
  runRpc(
    Effect.gen(function* () {
      const client = yield* KaiserRpcClient
      return yield* client.StartLibraryImport({ provider })
    })
  )
