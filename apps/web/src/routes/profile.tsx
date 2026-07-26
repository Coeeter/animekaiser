import { createFileRoute } from "@tanstack/react-router"
import { OwnProfilePage } from "../features/profile/profile-page"

export const Route = createFileRoute("/profile")({
  staticData: { title: "Profile" },
  component: OwnProfilePage,
})
