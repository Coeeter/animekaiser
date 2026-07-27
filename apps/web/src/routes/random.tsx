import { Result, useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { createFileRoute, Navigate } from "@tanstack/react-router"
import { DataError } from "../components/data-error"
import { randomAnimeAtom } from "../features/anime/home/atoms"

export const Route = createFileRoute("/random")({
  component: RandomRoute,
})

function RandomRoute() {
  const result = useAtomValue(randomAnimeAtom)
  const refresh = useAtomRefresh(randomAnimeAtom)
  return Result.builder(result)
    .onFailure(() => <DataError onRetry={refresh} />)
    .onSuccess((id) => <Navigate to="/series/$id" params={{ id }} replace />)
    .orNull()
}
