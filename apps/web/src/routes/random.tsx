import { createFileRoute, redirect } from "@tanstack/react-router"
import { loadRandomAnime } from "../features/anime/anime.functions"

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
