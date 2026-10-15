import { Atom } from "@effect-atom/atom-react"
import { KaiserRpcClient } from "../../services/api-clients"

export const socialReactivityKeys = ["friends"]

export const friendsAtom = KaiserRpcClient.query("ListFriends", void 0, {
  reactivityKeys: socialReactivityKeys,
})

export const searchUsersAtom = Atom.family((query: string) =>
  KaiserRpcClient.query(
    "SearchUsers",
    { query },
    { reactivityKeys: socialReactivityKeys }
  )
)

export const friendRelationAtom = Atom.family((username: string) =>
  KaiserRpcClient.query(
    "GetFriendRelation",
    { username },
    { reactivityKeys: socialReactivityKeys }
  )
)

export const sendFriendRequestAtom =
  KaiserRpcClient.mutation("SendFriendRequest")
export const respondFriendRequestAtom = KaiserRpcClient.mutation(
  "RespondFriendRequest"
)
export const removeFriendshipAtom = KaiserRpcClient.mutation("RemoveFriendship")
