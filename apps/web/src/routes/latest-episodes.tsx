import { createFileRoute } from "@tanstack/react-router"
import { LatestEpisodesPage } from "../features/anime/latest/latest-episodes-page"

export const Route = createFileRoute("/latest-episodes")({
  staticData: { title: "Latest Episodes" },
  component: LatestEpisodesPage,
})
