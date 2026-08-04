import { Rpc, RpcGroup } from "@effect/rpc"
import * as Schema from "effect/Schema"
import { MalId } from "../anime/models"
import {
  StreamAudio,
  StreamEpisodeCatalog,
  StreamEpisodeNotFoundError,
  StreamingUnavailableError,
  StreamPlayback,
  StreamProvider,
  StreamProviderId,
  StreamProviderNotFoundError,
  StreamProviderUnavailableError,
} from "./models"

const streamingFailure = Schema.Union(
  StreamingUnavailableError,
  StreamProviderNotFoundError,
  StreamProviderUnavailableError,
  StreamEpisodeNotFoundError
)

export class ListStreamProviders extends Rpc.make("ListStreamProviders", {
  success: Schema.Array(StreamProvider),
  error: StreamingUnavailableError,
}) {}

export class ListStreamEpisodes extends Rpc.make("ListStreamEpisodes", {
  payload: {
    malId: MalId,
    provider: Schema.optional(StreamProviderId),
  },
  success: StreamEpisodeCatalog,
  error: StreamingUnavailableError,
}) {}

export class GetStreamPlayback extends Rpc.make("GetStreamPlayback", {
  payload: {
    malId: MalId,
    provider: StreamProviderId,
    episodeId: Schema.String.pipe(Schema.minLength(1)),
    audio: StreamAudio,
    serverId: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  },
  success: StreamPlayback,
  error: streamingFailure,
}) {}

export class StreamingRpcs extends RpcGroup.make(
  ListStreamProviders,
  ListStreamEpisodes,
  GetStreamPlayback
) {}
