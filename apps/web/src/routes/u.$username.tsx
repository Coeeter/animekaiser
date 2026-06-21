import { createFileRoute } from "@tanstack/react-router"
import { PublicProfilePage } from "../features/profile/profile-page"
import { getPublicProfile } from "../profile.functions"

export const Route = createFileRoute("/u/$username")({
  loader: ({ params }) =>
    getPublicProfile({ data: { username: params.username } }),
  component: PublicProfileRoute,
})

function PublicProfileRoute() {
  return <PublicProfilePage data={Route.useLoaderData()} />
}
