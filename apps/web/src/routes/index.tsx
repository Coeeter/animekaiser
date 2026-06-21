import { createFileRoute } from "@tanstack/react-router"
import { loadAnimeHome } from "../features/anime/anime.functions"
import { HomePage } from "../features/anime/home-page"
import { getAppSession } from "../lib/session"

export const Route = createFileRoute("/")({
  loader: async () => {
    const [home, session] = await Promise.all([
      loadAnimeHome(),
      getAppSession(),
    ])
    return { home, loggedIn: Boolean(session) }
  },
  component: HomeRoute,
})

function HomeRoute() {
  return <HomePage {...Route.useLoaderData()} />
}
