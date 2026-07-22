import { createFileRoute } from "@tanstack/react-router"
import { getPublicProfile } from "../features/profile/profile.functions"
import { PublicProfilePage } from "../features/profile/profile-page"

export const Route = createFileRoute("/u/$username")({
  staticData: { title: "Profile" },
  loader: ({ params }) =>
    getPublicProfile({ data: { username: params.username } }),
  component: PublicProfileRoute,
})

function PublicProfileRoute() {
  return <PublicProfilePage data={Route.useLoaderData()} />
}
