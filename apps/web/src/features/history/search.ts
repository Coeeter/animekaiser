import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

const PositivePage = Schema.Union([
  Schema.Number,
  Schema.NumberFromString,
]).check(Schema.isInt(), Schema.isGreaterThan(0))

export const WatchHistorySearch = Schema.Struct({
  q: Schema.optional(Schema.String),
  page: PositivePage.pipe(Schema.withDecodingDefaultType(Effect.succeed(1))),
})
export type WatchHistorySearch = typeof WatchHistorySearch.Type

export const decodeWatchHistorySearch =
  Schema.decodeUnknownSync(WatchHistorySearch)
