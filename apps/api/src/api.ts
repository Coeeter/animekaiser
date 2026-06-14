import * as HttpApi from "@effect/platform/HttpApi"
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder"
import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint"
import * as HttpApiGroup from "@effect/platform/HttpApiGroup"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"

export const Api = HttpApi.make("api").add(
  HttpApiGroup.make("helloWorld").add(
    HttpApiEndpoint.get("get", "/").addSuccess(
      Schema.Struct({
        message: Schema.String,
      })
    )
  )
)

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(
    HttpApiBuilder.group(Api, "helloWorld", (handlers) =>
      handlers.handle("get", () => Effect.succeed({ message: "hello world" }))
    )
  )
)
