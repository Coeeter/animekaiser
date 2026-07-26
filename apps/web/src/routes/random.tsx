import {
  Result,
  useAtomMount,
  useAtomRefresh,
  useAtomValue,
} from "@effect-atom/atom-react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { DataError } from "../components/data-error"
import {
  navigateToRandomAnimeAtom,
  randomAnimeAtom,
} from "../features/anime/home/atoms"

export const Route = createFileRoute("/random")({
  component: RandomRoute,
})

function RandomRoute() {
  const result = useAtomValue(randomAnimeAtom)
  const refresh = useAtomRefresh(randomAnimeAtom)
  const router = useRouter()

  useAtomMount(navigateToRandomAnimeAtom(router))

  return Result.builder(result)
    .onFailure(() => <DataError onRetry={refresh} />)
    .orNull()
}
