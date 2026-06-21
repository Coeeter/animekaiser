import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import * as Schema from "effect/Schema"
import { apiUrl } from "./auth"

const AppSession = Schema.NullOr(
  Schema.Struct({
    user: Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      email: Schema.String,
      image: Schema.NullOr(Schema.String),
      username: Schema.optional(Schema.NullOr(Schema.String)),
      displayUsername: Schema.optional(Schema.NullOr(Schema.String)),
    }),
  })
)

export type AppSession = typeof AppSession.Type

export const getAppSession = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const requestHeaders = getRequestHeaders()
      const response = await fetch(new URL("/api/auth/get-session", apiUrl), {
        headers: { cookie: requestHeaders.get("cookie") ?? "" },
      })
      if (!response.ok) return null
      return Schema.decodeUnknownSync(AppSession)(await response.json())
    } catch {
      return null
    }
  }
)
