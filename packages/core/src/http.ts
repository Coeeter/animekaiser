import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"

// Trace headers would leak our span ids to third-party APIs.
export const withoutTracePropagation = HttpClient.transformResponse(
  Effect.provideService(HttpClient.TracerPropagationEnabled, false)
)
