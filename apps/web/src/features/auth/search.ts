import * as Schema from "effect/Schema"

export const LoginSearch = Schema.Struct({
  redirect: Schema.optional(Schema.String),
})
export type LoginSearch = typeof LoginSearch.Type

export const decodeLoginSearch = Schema.decodeUnknownSync(LoginSearch)
