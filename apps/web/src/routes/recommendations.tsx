import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { RecommendationsPage } from "../features/recommendations/recommendations-page"

const Search = Schema.Struct({
  thread: Schema.optional(Schema.UUID),
  seed: Schema.optional(
    Schema.NumberFromString.pipe(Schema.int(), Schema.positive())
  ),
})

export const Route = createFileRoute("/recommendations")({
  staticData: { title: "Recommendations" },
  validateSearch: Schema.decodeUnknownSync(Search),
  component: RecommendationsRoute,
})

function RecommendationsRoute() {
  const search = Route.useSearch()
  return (
    <RecommendationsPage
      threadId={search.thread ?? null}
      seedMalId={search.seed}
    />
  )
}
