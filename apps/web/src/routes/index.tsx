import { createFileRoute } from "@tanstack/react-router"
import { HomePage } from "../features/anime/home/home-page"

export const Route = createFileRoute("/")({
  staticData: { title: "Home" },
  component: HomePage,
})
