import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as JSONSchema from "effect/JSONSchema"
import * as Schema from "effect/Schema"

export type AiMessage = {
  readonly role: "user" | "assistant"
  readonly content: string
}

// A function the model may call. `call` decodes the model's JSON arguments;
// invalid input goes back to the model as an error so it can retry.
export type AgentTool = {
  readonly name: string
  readonly description: string
  readonly activity: string
  readonly inputSchema: JSONSchema.JsonSchema7Root
  readonly strict: boolean
  readonly call: (
    args: string
  ) => Effect.Effect<{ readonly ok: boolean; readonly output: unknown }>
}

export const agentTool = <A, I>(tool: {
  readonly name: string
  readonly description: string
  readonly activity: string
  readonly parameters: Schema.Schema<A, I, never>
  // Makes the provider enforce the schema. Every field must be required
  // (nullable instead of optional) for it to be accepted.
  readonly strict?: boolean
  readonly execute: (input: A) => Effect.Effect<unknown>
}): AgentTool => {
  const decode = Schema.decodeUnknown(Schema.parseJson(tool.parameters))
  return {
    name: tool.name,
    description: tool.description,
    activity: tool.activity,
    // Strict mode rejects the `$ref`s refinements like Int produce, so strict
    // tools describe only the encoded shape; decoding still checks them.
    inputSchema: tool.strict
      ? JSONSchema.make(Schema.encodedSchema(tool.parameters), {
          target: "jsonSchema2020-12",
        })
      : JSONSchema.make(tool.parameters, { target: "jsonSchema2020-12" }),
    strict: tool.strict ?? false,
    call: (args) =>
      decode(args).pipe(
        Effect.flatMap(tool.execute),
        Effect.map((output) => ({ ok: true, output })),
        Effect.catchTag("ParseError", (error) =>
          Effect.logWarning(
            `[AI] Invalid input for ${tool.name}`,
            error.message,
            args.slice(0, 600)
          ).pipe(Effect.as({ ok: false, output: { error: error.message } }))
        )
      ),
  }
}

export type AgentProgress = {
  readonly text: string
  readonly activity: string | null
}

export type AgentRequest = {
  readonly instructions: string
  readonly messages: ReadonlyArray<AiMessage>
  readonly tools: ReadonlyArray<AgentTool>
  // Enables the provider's web search tool, for at most `maxSearches`.
  readonly web: boolean
  readonly maxSearches: number
  readonly maxSteps: number
  readonly maxCostUsd: number
  // Per model call, reasoning included. Chat-sized caps also limit what an
  // off-topic or injected request can extract.
  readonly maxOutputTokens: number
  readonly reasoning: "low" | "medium" | "high"
  // Ends the run once this tool has been called successfully.
  readonly finishWith?: string
  readonly onProgress?: (progress: AgentProgress) => Effect.Effect<void>
}

// A page the provider actually searched, fetched, or cited during the run.
export type AgentEvidence = {
  readonly url: string
  readonly title: string | null
}

export type AgentResult = {
  readonly text: string
  readonly evidence: ReadonlyArray<AgentEvidence>
  readonly costUsd: number | null
  readonly usage: unknown
}

export class AiProviderError extends Schema.TaggedError<AiProviderError>()(
  "AiProviderError",
  { message: Schema.String }
) {}

// Implemented by the API composition root. `run` is absent when no
// credential is configured, which disables AI without blocking startup.
export class AiProvider extends Context.Tag("@animekaiser/core/AiProvider")<
  AiProvider,
  {
    readonly model: string
    readonly run:
      | ((request: AgentRequest) => Effect.Effect<AgentResult, AiProviderError>)
      | null
  }
>() {}
