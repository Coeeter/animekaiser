import {
  ProfileImageContentType,
  type ProfileImageKind,
} from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpBody from "effect/http/HttpBody"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Atom from "effect/reactivity/Atom"
import * as Reactivity from "effect/reactivity/Reactivity"
import * as Schema from "effect/Schema"
import { KaiserRpcClient } from "../../services/api-clients"
import { auth } from "../../services/auth"
import { sessionReactivityKeys } from "../auth/atoms"

export type PublicProfileKey = {
  readonly username: string
  readonly asPublic: boolean
}

export const profileReactivityKeys = ["profile"]

export const profileMutationKeys = [
  ...profileReactivityKeys,
  ...sessionReactivityKeys,
]

export const ownProfileAtom = KaiserRpcClient.query("GetOwnProfile", void 0, {
  reactivityKeys: profileReactivityKeys,
})

const publicProfileFamily = Atom.family(
  ({ username, asPublic }: PublicProfileKey) =>
    KaiserRpcClient.query(
      "GetPublicProfile",
      { username, asPublic },
      { reactivityKeys: profileReactivityKeys }
    )
)

export const publicProfileAtom = (key: PublicProfileKey) =>
  publicProfileFamily(key)

export const ownProfileStatsAtom = KaiserRpcClient.query(
  "GetOwnProfileStats",
  void 0,
  {
    reactivityKeys: profileReactivityKeys,
  }
)

const publicProfileStatsFamily = Atom.family(
  ({ username, asPublic }: PublicProfileKey) =>
    KaiserRpcClient.query(
      "GetPublicProfileStats",
      { username, asPublic },
      { reactivityKeys: profileReactivityKeys }
    )
)

export const publicProfileStatsAtom = (key: PublicProfileKey) =>
  publicProfileStatsFamily(key)

export const suggestUsernamesAtom = KaiserRpcClient.query(
  "SuggestUsernames",
  void 0,
  { reactivityKeys: profileReactivityKeys }
)

export class UsernameTakenError extends Schema.TaggedError<UsernameTakenError>()(
  "UsernameTakenError",
  { message: Schema.String }
) {}

// Checks availability first so a taken name gets a clear message instead of
// Better Auth's generic conflict.
export const claimUsernameAtom = KaiserRpcClient.runtime.fn(
  Effect.fnUntraced(function* (username: string) {
    const client = yield* KaiserRpcClient
    const { available } = yield* client("CheckUsername", { username })
    if (!available)
      return yield* new UsernameTakenError({
        message: "That username is taken.",
      })
    yield* auth((authClient) =>
      authClient.updateUser({
        username,
        displayUsername: username,
        name: username,
      })
    )
  })
)

export const beginOnboardingAtom = KaiserRpcClient.mutation("BeginOnboarding")

export const completeOnboardingAtom =
  KaiserRpcClient.mutation("CompleteOnboarding")

export const updateProfileAtom = KaiserRpcClient.mutation("UpdateProfile")
export const updatePrivacyAtom = KaiserRpcClient.mutation("UpdatePrivacy")

export class ProfileImageUploadError extends Schema.TaggedError<ProfileImageUploadError>()(
  "ProfileImageUploadError",
  { message: Schema.String }
) {}

const maxImageBytes = 5 * 1024 * 1024
const invalidImage = new ProfileImageUploadError({
  message: "Upload a JPEG, PNG, or WebP image up to 5 MB.",
})

// Reserves a storage slot, uploads the file straight to storage, then records
// it on the profile.
export const uploadProfileImageAtom = Atom.family((kind: ProfileImageKind) =>
  KaiserRpcClient.runtime.fn(
    Effect.fnUntraced(function* (file: File) {
      if (file.size > maxImageBytes) return yield* invalidImage
      const contentType = yield* Schema.decodeUnknownEffect(
        ProfileImageContentType
      )(file.type).pipe(Effect.mapError(() => invalidImage))
      const client = yield* KaiserRpcClient
      const target = yield* client("CreateProfileImageUpload", {
        kind,
        contentType,
        size: file.size,
      })
      yield* HttpClient.execute(
        HttpClientRequest.put(target.uploadUrl).pipe(
          HttpClientRequest.setBody(HttpBody.raw(file, { contentType }))
        )
      ).pipe(
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.mapError(
          () =>
            new ProfileImageUploadError({ message: "Unable to upload image." })
        ),
        Effect.provide(FetchHttpClient.layer)
      )
      yield* Reactivity.mutation(
        client("CompleteProfileImageUpload", { kind, key: target.key }),
        profileMutationKeys
      )
    })
  )
)

export const removeProfileImageAtom =
  KaiserRpcClient.mutation("RemoveProfileImage")

export const deleteAccountAtom = KaiserRpcClient.mutation("DeleteAccount")
