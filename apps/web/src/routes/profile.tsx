import { createFileRoute, redirect } from "@tanstack/react-router"
import { getAppSession } from "../auth.functions"
import { OwnProfilePage } from "../features/profile/profile-page"
import { getOwnProfile } from "../profile.functions"

export const Route = createFileRoute("/profile")({
  beforeLoad: async () => {
    if (!(await getAppSession())) {
      throw redirect({ to: "/login", search: { redirect: "/profile" } })
    }
  },
  loader: () => getOwnProfile(),
  component: ProfileRoute,
})

function ProfileRoute() {
  return <OwnProfilePage data={Route.useLoaderData()} />
}
