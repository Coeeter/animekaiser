import { createFileRoute } from "@tanstack/react-router"
import { PublicProfilePage } from "../features/profile/profile-page"

export const Route = createFileRoute("/u/$username")({
  staticData: { title: "Profile" },
  component: PublicProfileRoute,
})

function PublicProfileRoute() {
  return <PublicProfilePage username={Route.useParams().username} />
}
