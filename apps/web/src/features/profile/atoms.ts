import { KaiserRpcClient } from "../../services/api-clients"
import { sessionReactivityKeys } from "../auth/atoms"

export const profileReactivityKeys = ["profile"]

export const profileMutationKeys = [
  ...profileReactivityKeys,
  ...sessionReactivityKeys,
]

export const ownProfileAtom = KaiserRpcClient.query("GetOwnProfile", void 0, {
  reactivityKeys: profileReactivityKeys,
})

export const publicProfileAtom = (username: string) =>
  KaiserRpcClient.query(
    "GetPublicProfile",
    { username },
    { reactivityKeys: profileReactivityKeys }
  )

export const ownProfileStatsAtom = KaiserRpcClient.query(
  "GetOwnProfileStats",
  void 0,
  {
    reactivityKeys: profileReactivityKeys,
  }
)

export const publicProfileStatsAtom = (username: string) =>
  KaiserRpcClient.query(
    "GetPublicProfileStats",
    { username },
    { reactivityKeys: profileReactivityKeys }
  )

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
