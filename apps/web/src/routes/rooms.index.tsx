import { createFileRoute } from "@tanstack/react-router"
import { RoomsPage } from "../features/rooms/rooms-page"

export const Route = createFileRoute("/rooms/")({
  staticData: { title: "Rooms" },
  component: RoomsPage,
})
