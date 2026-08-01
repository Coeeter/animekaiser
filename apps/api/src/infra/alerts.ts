import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as HttpBody from "@effect/platform/HttpBody"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as Cause from "effect/Cause"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Redacted from "effect/Redacted"

const DISCORD_CONTENT_LIMIT = 2000

const alertConfig = Config.all({
  webhookUrl: Config.redacted("DISCORD_ALERT_WEBHOOK_URL").pipe(Config.option),
  env: Config.string("ENV").pipe(Config.withDefault("dev")),
})

const buildContent = (env: string, cause: Cause.Cause<unknown>) => {
  const header = `🚨 **AnimeKaiser API crashed** (\`${env}\`)`
  const fence = "```"
  const room =
    DISCORD_CONTENT_LIMIT - header.length - fence.length * 2 - "\n\n\n".length
  const detail = Cause.pretty(cause)
  const body = detail.length > room ? `${detail.slice(0, room - 1)}…` : detail
  return `${header}\n${fence}\n${body}\n${fence}`
}

/**
 * Interrupt-only causes are how a redeploy looks from inside the process: Bun
 * translates SIGTERM into a fiber interrupt, so alerting on them would page us
 * on every successful deployment.
 */
export const reportFatalCause = (cause: Cause.Cause<unknown>) =>
  Effect.gen(function* () {
    if (Cause.isInterruptedOnly(cause)) return

    const { webhookUrl, env } = yield* alertConfig
    if (webhookUrl._tag === "None") return

    const client = yield* HttpClient.HttpClient
    yield* client.execute(
      HttpClientRequest.post(Redacted.value(webhookUrl.value), {
        body: HttpBody.unsafeJson({ content: buildContent(env, cause) }),
      })
    )
  }).pipe(
    Effect.timeout("10 seconds"),
    Effect.provide(FetchHttpClient.layer),
    Effect.tapErrorCause((reportCause) =>
      Effect.logError(
        `[Alerts] Failed to deliver crash alert: ${Cause.pretty(reportCause)}`
      )
    ),
    Effect.ignore
  )
