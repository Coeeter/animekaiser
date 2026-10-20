import {
  type AgentEvidence,
  type AgentProgress,
  type AgentTool,
  type AiMessage,
  AiProvider,
  AiProviderError,
} from "@animekaiser/core"
import { AiModelId } from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import * as Sse from "effect/encoding/Sse"
import * as Filter from "effect/Filter"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { Env } from "../env"

const responsesUrl = "https://openrouter.ai/api/v1/responses"

// The exa engine returns the URLs it searched, which recaps are checked
// against. The native engine hides them and parallel took minutes per search.
const webSearch = {
  type: "openrouter:web_search",
  parameters: { engine: "exa", max_results: 5 },
}

const Annotation = Schema.Struct({
  type: Schema.String,
  url: Schema.optional(Schema.String),
  title: Schema.optional(Schema.NullOr(Schema.String)),
})

const OutputItem = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("function_call"),
    call_id: Schema.String,
    name: Schema.String,
    arguments: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("openrouter:web_search"),
    action: Schema.optional(
      Schema.Struct({
        sources: Schema.optional(
          Schema.Array(Schema.Struct({ url: Schema.String }))
        ),
      })
    ),
  }),
  Schema.Struct({
    type: Schema.Literal("message"),
    content: Schema.Array(
      Schema.Struct({
        type: Schema.String,
        text: Schema.optional(Schema.String),
        annotations: Schema.optional(Schema.Array(Annotation)),
      })
    ),
  }),
])
const decodeOutputItem = Schema.decodeUnknownOption(OutputItem)

const ResponseBody = Schema.Struct({
  status: Schema.String,
  // Sent back verbatim on the next step, reasoning items included.
  output: Schema.Array(Schema.Unknown),
  usage: Schema.optional(
    Schema.NullOr(
      Schema.StructWithRest(
        Schema.Struct({ cost: Schema.optional(Schema.NullOr(Schema.Finite)) }),
        [Schema.Record(Schema.String, Schema.Unknown)]
      )
    )
  ),
  error: Schema.optional(
    Schema.NullOr(Schema.Struct({ message: Schema.String }))
  ),
})

const StreamEvent = Schema.fromJsonString(
  Schema.Struct({
    type: Schema.String,
    delta: Schema.optional(Schema.Unknown),
    item: Schema.optional(
      Schema.Struct({
        type: Schema.String,
        name: Schema.optional(Schema.String),
      })
    ),
    response: Schema.optional(ResponseBody),
    message: Schema.optional(Schema.String),
  })
)
const decodeStreamEvent = Schema.decodeUnknownOption(StreamEvent)

const terminalEvents = new Set([
  "response.completed",
  "response.incomplete",
  "response.failed",
  "error",
])

// The decoder drops a final event that lacks its closing blank line, which
// would lose the terminal response event if the upstream omits it.
export const sseData = <E>(text: Stream.Stream<string, E>) =>
  text.pipe(
    Stream.concat(Stream.make("\n\n")),
    Stream.pipeThroughChannel(Sse.decode()),
    Stream.map((event) => event.data)
  )

const toFunctionTool = (entry: AgentTool) => {
  const { $schema: _, ...parameters } = entry.inputSchema
  return {
    type: "function",
    name: entry.name,
    description: entry.description,
    parameters,
    strict: entry.strict,
  }
}

const toHistory = (messages: ReadonlyArray<AiMessage>): Array<unknown> =>
  messages.map((message) =>
    message.role === "user"
      ? { role: "user", content: message.content }
      : {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: message.content }],
        }
  )

const failWith = (message: string) => new AiProviderError({ message })

export const OpenRouterLive = Layer.effect(
  AiProvider,
  Effect.gen(function* () {
    const env = yield* Env
    const key = env.ai.openRouterApiKey
    if (Option.isNone(key)) {
      yield* Effect.logInfo(
        "[AI] OPENROUTER_API_KEY is not set; AI is disabled."
      )
      return { model: AiModelId, run: null }
    }
    const client = yield* HttpClient.HttpClient

    const respond = (
      body: Record<string, unknown>,
      onEvent: (event: {
        readonly type: string
        readonly delta?: unknown
        readonly item?: { readonly type: string; readonly name?: string }
      }) => Effect.Effect<void>
    ) =>
      Effect.gen(function* () {
        const response = yield* HttpClientRequest.post(responsesUrl).pipe(
          HttpClientRequest.bearerToken(key.value),
          HttpClientRequest.setHeaders({
            "x-title": "AnimeKaiser",
            "http-referer": env.app.url,
          }),
          HttpClientRequest.bodyJson({ ...body, stream: true }),
          Effect.flatMap(client.execute),
          Effect.mapError((error) => failWith(error.message))
        )
        if (response.status >= 400) {
          const detail = yield* response.text.pipe(
            Effect.orElseSucceed(() => "")
          )
          return yield* failWith(
            `OpenRouter returned ${response.status}: ${detail.slice(0, 300)}`
          )
        }
        const last = yield* sseData(
          response.stream.pipe(Stream.decodeText())
        ).pipe(
          Stream.filterMap(Filter.fromPredicateOption(decodeStreamEvent)),
          Stream.takeUntil((event) => terminalEvents.has(event.type)),
          Stream.tap(onEvent),
          Stream.runLast,
          Effect.mapError((error) =>
            failWith(
              error._tag === "Retry"
                ? "The stream asked to reconnect."
                : error.message
            )
          )
        )
        const terminal = Option.getOrUndefined(
          Option.filter(last, (event) => terminalEvents.has(event.type))
        )
        if (!terminal) return yield* failWith("The stream ended early.")
        if (terminal.type === "error" || !terminal.response)
          return yield* failWith(terminal.message ?? "The stream failed.")
        if (terminal.type === "response.incomplete")
          return yield* failWith("The answer was cut off.")
        if (terminal.type === "response.failed")
          return yield* failWith(
            terminal.response.error?.message ?? "The response failed."
          )
        return terminal.response
      })

    return {
      model: AiModelId,
      run: (request) =>
        Effect.gen(function* () {
          const tools = new Map(
            request.tools.map((entry) => [entry.name, entry])
          )
          const functions = request.tools.map(toFunctionTool)
          let web = request.web
          const input = toHistory(request.messages)
          const evidence = new Map<string, AgentEvidence>()
          const addEvidence = (
            url: string | undefined,
            title?: string | null
          ) => {
            if (!url) return
            evidence.set(url, {
              url,
              title: title ?? evidence.get(url)?.title ?? null,
            })
          }
          const usage: Array<unknown> = []
          let cost = 0
          let costKnown = true
          let searches = 0
          let progress: AgentProgress = { text: "", activity: null }
          let reportedAt = 0
          const report = (next: AgentProgress, force: boolean) => {
            const now = Date.now()
            progress = next
            if (!request.onProgress || (!force && now - reportedAt < 250))
              return Effect.void
            reportedAt = now
            return request.onProgress(next)
          }

          const result = (text: string) => ({
            text,
            evidence: [...evidence.values()],
            costUsd: costKnown ? cost : null,
            usage,
          })
          let answer = ""

          for (let step = 1; ; step++) {
            if (cost >= request.maxCostUsd) return result(answer)
            // The last allowed step must answer instead of calling more tools,
            // and leaves headroom under the cap for that answer.
            const last =
              step >= request.maxSteps || cost >= request.maxCostUsd * 0.6
            if (last || searches >= request.maxSearches) web = false
            const response = yield* respond(
              {
                model: AiModelId,
                instructions: request.instructions,
                input,
                tools: web ? [...functions, webSearch] : functions,
                tool_choice: !last
                  ? "auto"
                  : request.finishWith
                    ? { type: "function", name: request.finishWith }
                    : "none",
                max_output_tokens: request.maxOutputTokens,
                reasoning: { effort: request.reasoning },
                provider: { require_parameters: true },
              },
              (event) => {
                if (event.type === "response.output_text.delta")
                  return typeof event.delta === "string"
                    ? report(
                        {
                          text: progress.text + event.delta,
                          activity: null,
                        },
                        false
                      )
                    : Effect.void
                if (event.type !== "response.output_item.added" || !event.item)
                  return Effect.void
                switch (event.item.type) {
                  case "message":
                    return report({ text: "", activity: null }, false)
                  case "function_call":
                    return report(
                      {
                        text: progress.text,
                        activity:
                          tools.get(event.item.name ?? "")?.activity ??
                          "Working…",
                      },
                      true
                    )
                  case "openrouter:web_search":
                    return report(
                      { text: progress.text, activity: "Searching the web…" },
                      true
                    )
                  default:
                    return Effect.void
                }
              }
            )
            const stepCost = response.usage?.cost
            if (stepCost === undefined || stepCost === null) costKnown = false
            else cost += stepCost
            usage.push(response.usage)
            input.push(...response.output)

            let text = ""
            const calls: Array<{ callId: string; name: string; args: string }> =
              []
            for (const raw of response.output) {
              const item = decodeOutputItem(raw)
              if (Option.isNone(item)) continue
              const value = item.value
              switch (value.type) {
                case "function_call":
                  calls.push({
                    callId: value.call_id,
                    name: value.name,
                    args: value.arguments,
                  })
                  break
                case "openrouter:web_search":
                  searches += 1
                  for (const source of value.action?.sources ?? [])
                    addEvidence(source.url)
                  break
                case "message":
                  for (const part of value.content) {
                    if (part.type !== "output_text") continue
                    text += part.text ?? ""
                    for (const annotation of part.annotations ?? [])
                      if (annotation.type === "url_citation")
                        addEvidence(annotation.url, annotation.title)
                  }
                  break
              }
            }

            let finished = calls.length === 0
            for (const call of calls) {
              const tool = tools.get(call.name)
              const outcome = tool
                ? yield* tool.call(call.args)
                : { ok: false, output: { error: `Unknown tool ${call.name}.` } }
              if (outcome.ok && call.name === request.finishWith)
                finished = true
              // OpenRouter stops enforcing strict schemas while its web
              // search tool is offered, so the retry goes without it.
              if (!outcome.ok && tool?.strict) web = false
              input.push({
                type: "function_call_output",
                call_id: call.callId,
                output: JSON.stringify(outcome.output),
              })
            }
            answer = text || answer
            if (finished || last) return result(answer)
          }
        }).pipe(
          Effect.timeoutOrElse({
            duration: "120 seconds",
            orElse: () => Effect.fail(failWith("Timed out.")),
          })
        ),
    }
  })
).pipe(Layer.provide(FetchHttpClient.layer))
