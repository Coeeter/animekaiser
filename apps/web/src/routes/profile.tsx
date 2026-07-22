import { createFileRoute, redirect } from "@tanstack/react-router"
import { getOwnProfile } from "../features/profile/profile.functions"
import { OwnProfilePage } from "../features/profile/profile-page"
import { getAppSession } from "../lib/session"

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
