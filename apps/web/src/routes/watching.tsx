import { createFileRoute } from "@tanstack/react-router"
import { WatchingPage } from "../features/history/watching-page"

export const Route = createFileRoute("/watching")({
  staticData: { title: "Watching" },
  component: WatchingPage,
})
