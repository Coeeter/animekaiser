import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { loadAnimeDetail } from "../features/anime/anime.functions"
import { AnimeDetailPage } from "../features/anime/detail-page"

const SeriesId = Schema.NumberFromString.pipe(Schema.int(), Schema.positive())

export const Route = createFileRoute("/series/$id")({
  parseParams: ({ id }) => ({ id: Schema.decodeUnknownSync(SeriesId)(id) }),
  stringifyParams: ({ id }) => ({ id: String(id) }),
  loader: ({ params }) => loadAnimeDetail(params.id),
  component: AnimeDetailRoute,
})

function AnimeDetailRoute() {
  return (
    <AnimeDetailPage
      id={Route.useParams().id}
      initial={Route.useLoaderData()}
    />
  )
}
