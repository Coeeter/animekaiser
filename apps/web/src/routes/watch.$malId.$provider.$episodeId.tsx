import { createFileRoute } from "@tanstack/react-router"
import type { StreamAudio } from "@workspace/domain"
import {
  StreamAudio as StreamAudioSchema,
  StreamProviderId,
} from "@workspace/domain"
import * as Schema from "effect/Schema"
import {
  StreamPlayerPage,
  StreamPlayerPendingPage,
} from "../features/streaming/player-page"
import { loadStreamPlayback } from "../features/streaming/streaming.functions"

const defaultAudio: StreamAudio = "sub"

const WatchMalId = Schema.NumberFromString.pipe(Schema.int(), Schema.positive())
const WatchEpisodeId = Schema.String.pipe(Schema.minLength(1))
const WatchSearch = Schema.Struct({
  audio: Schema.optional(StreamAudioSchema),
  serverId: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
})
const decodeWatchSearch = Schema.decodeUnknownSync(WatchSearch)

export const Route = createFileRoute("/watch/$malId/$provider/$episodeId")({
  parseParams: ({ malId, provider, episodeId }) => ({
    malId: Schema.decodeUnknownSync(WatchMalId)(malId),
    provider: Schema.decodeUnknownSync(StreamProviderId)(provider),
    episodeId: Schema.decodeUnknownSync(WatchEpisodeId)(episodeId),
  }),
  stringifyParams: ({ malId, provider, episodeId }) => ({
    malId: String(malId),
    provider,
    episodeId,
  }),
  validateSearch: Schema.decodeUnknownSync(WatchSearch),
  loaderDeps: ({ search }) => ({
    audio: decodeWatchSearch(search).audio ?? defaultAudio,
    serverId: decodeWatchSearch(search).serverId,
  }),
  loader: ({ params, deps }) =>
    loadStreamPlayback({
      malId: params.malId,
      provider: params.provider,
      episodeId: params.episodeId,
      audio: deps.audio,
      serverId: deps.serverId,
    }),
  pendingComponent: StreamPlayerPendingPage,
  component: WatchRoute,
})

function WatchRoute() {
  const params = Route.useParams()
  const search = decodeWatchSearch(Route.useSearch())
  const input = {
    malId: params.malId,
    provider: params.provider,
    episodeId: params.episodeId,
    audio: search.audio ?? defaultAudio,
    serverId: search.serverId,
  }

  return <StreamPlayerPage input={input} initial={Route.useLoaderData()} />
}
