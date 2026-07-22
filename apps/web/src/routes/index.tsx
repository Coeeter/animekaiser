import { createFileRoute } from "@tanstack/react-router"
import { loadAnimeHome } from "../features/anime/anime.functions"
import { HomePage, HomePendingPage } from "../features/anime/home-page"

export const Route = createFileRoute("/")({
  staticData: { title: "Home" },
  loader: loadAnimeHome,
  pendingComponent: HomePendingPage,
  component: HomeRoute,
})

function HomeRoute() {
  return <HomePage home={Route.useLoaderData()} />
}
