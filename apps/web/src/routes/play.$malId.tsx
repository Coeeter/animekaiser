import { useAtomValue } from "@effect/atom-react"
import { createFileRoute, Navigate } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Schema from "effect/Schema"
import { watchTargetAtom } from "../features/streaming/atoms"
import { StreamPlayerPendingPage } from "../features/streaming/player/pending-page"

const PlayMalId = Schema.NumberFromString.check(
  Schema.isInt(),
  Schema.isGreaterThan(0)
)

// Cards only know the anime; the provider episode to play is resolved here so
// rows do not fetch every show's episode list up front.
export const Route = createFileRoute("/play/$malId")({
  staticData: { title: "Watch" },
  parseParams: ({ malId }) => ({
    malId: Schema.decodeUnknownSync(PlayMalId)(malId),
  }),
  stringifyParams: ({ malId }) => ({ malId: String(malId) }),
  component: PlayRoute,
})

function PlayRoute() {
  const { malId } = Route.useParams()
  const result = useAtomValue(watchTargetAtom({ malId }))

  return AsyncResult.builder(result)
    .onSuccess((target) =>
      target ? (
        <Navigate
          to="/watch/$malId/$provider/$episodeId"
          params={{
            malId: target.malId,
            provider: target.provider,
            episodeId: target.episodeId,
          }}
          search={{ audio: target.audio }}
          replace
        />
      ) : (
        <Navigate to="/series/$id" params={{ id: malId }} replace />
      )
    )
    .onFailure(() => (
      <Navigate to="/series/$id" params={{ id: malId }} replace />
    ))
    .orElse(() => <StreamPlayerPendingPage />)
}
