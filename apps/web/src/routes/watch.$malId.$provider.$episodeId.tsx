import { createFileRoute } from "@tanstack/react-router"
import type { StreamAudio } from "@workspace/domain"
import {
  StreamAudio as StreamAudioSchema,
  StreamProviderId,
} from "@workspace/domain"
import * as Schema from "effect/Schema"
import { StreamPlayerPage } from "../features/streaming/player-page"

const defaultAudio: StreamAudio = "sub"

const WatchMalId = Schema.NumberFromString.pipe(Schema.int(), Schema.positive())
const WatchEpisodeId = Schema.String.pipe(Schema.minLength(1))
const WatchSearch = Schema.Struct({
  audio: Schema.optional(StreamAudioSchema),
  serverId: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
})

const decodeWatchSearch = Schema.decodeUnknownSync(WatchSearch)

export const Route = createFileRoute("/watch/$malId/$provider/$episodeId")({
  staticData: { title: "Watch" },
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

  return <StreamPlayerPage input={input} />
}
