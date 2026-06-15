import * as HttpApi from "@effect/platform/HttpApi"
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder"
import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint"
import * as HttpApiGroup from "@effect/platform/HttpApiGroup"
import { DomainApi } from "@workspace/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"

export const Api = HttpApi.make("api")
  .add(
    HttpApiGroup.make("Entry").add(
      HttpApiEndpoint.get("hello-world")`/`.addSuccess(Schema.String)
    )
  )
  .add(DomainApi)

const GreetingsLive = HttpApiBuilder.group(Api, "Entry", (handlers) =>
  handlers.handle("hello-world", () => Effect.succeed("Hello, World!"))
)

const DomainLive = HttpApiBuilder.group(Api, "Domain", (handlers) => handlers)

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide([GreetingsLive, DomainLive])
)
