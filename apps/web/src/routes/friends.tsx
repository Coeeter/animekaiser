import { createFileRoute } from "@tanstack/react-router"
import { FriendsPage } from "../features/social/friends-page"

export const Route = createFileRoute("/friends")({
  staticData: { title: "Friends" },
  component: FriendsPage,
})
