import { Atom } from "@effect-atom/atom-react"
import * as Data from "effect/Data"
import { KaiserRpcClient } from "../../services/api-clients"
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
  publicProfileFamily(Data.struct(key))

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
  publicProfileStatsFamily(Data.struct(key))

export const updateProfileAtom = KaiserRpcClient.mutation("UpdateProfile")
export const updatePrivacyAtom = KaiserRpcClient.mutation("UpdatePrivacy")

export const createProfileImageUploadAtom = KaiserRpcClient.mutation(
  "CreateProfileImageUpload"
)

export const completeProfileImageUploadAtom = KaiserRpcClient.mutation(
  "CompleteProfileImageUpload"
)

export const removeProfileImageAtom =
  KaiserRpcClient.mutation("RemoveProfileImage")

export const deleteAccountAtom = KaiserRpcClient.mutation("DeleteAccount")
