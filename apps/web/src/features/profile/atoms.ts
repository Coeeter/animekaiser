import {
  KaiserRpcClient,
  refreshOnAuthChange,
} from "../../services/api-clients"

export const profileReactivityKeys = ["profile"]

export const ownProfileAtom = refreshOnAuthChange(
  KaiserRpcClient.query("GetOwnProfile", void 0, {
    reactivityKeys: profileReactivityKeys,
  })
)

export const publicProfileAtom = (username: string) =>
  refreshOnAuthChange(KaiserRpcClient.query("GetPublicProfile", { username }))

export const ownProfileStatsAtom = refreshOnAuthChange(
  KaiserRpcClient.query("GetOwnProfileStats", void 0, {
    reactivityKeys: profileReactivityKeys,
  })
)

export const publicProfileStatsAtom = (username: string) =>
  refreshOnAuthChange(
    KaiserRpcClient.query("GetPublicProfileStats", { username })
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
