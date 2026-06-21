import { createFileRoute } from "@tanstack/react-router"
import { LatestEpisodesPage } from "../features/anime/latest-episodes-page"

export const Route = createFileRoute("/latest-episodes")({
  component: LatestEpisodesPage,
})
