import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { PublicProfilePage } from "../features/profile/profile-page"

const PublicProfileSearch = Schema.Struct({
  as: Schema.optional(Schema.Literal("public")),
})

export const Route = createFileRoute("/u/$username")({
  staticData: { title: "Profile" },
  validateSearch: Schema.decodeUnknownSync(PublicProfileSearch),
  component: PublicProfileRoute,
})

function PublicProfileRoute() {
  return (
    <PublicProfilePage
      username={Route.useParams().username}
      asPublic={Route.useSearch().as === "public"}
    />
  )
}
