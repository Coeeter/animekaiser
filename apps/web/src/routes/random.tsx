import { createFileRoute, redirect } from "@tanstack/react-router"
import { loadRandomAnime } from "../api"

export const Route = createFileRoute("/random")({
  loader: async () => {
    const malId = await loadRandomAnime()
    throw redirect({
      to: "/series/$id",
      params: { id: malId },
      replace: true,
    })
  },
})
