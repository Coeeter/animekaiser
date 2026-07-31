import * as Schema from "effect/Schema"

const PositivePage = Schema.Union(Schema.Number, Schema.NumberFromString).pipe(
  Schema.int(),
  Schema.positive()
)

export const WatchHistorySearch = Schema.Struct({
  q: Schema.optional(Schema.String),
  page: Schema.optionalWith(PositivePage, { default: () => 1 }),
})
export type WatchHistorySearch = typeof WatchHistorySearch.Type

export const decodeWatchHistorySearch =
  Schema.decodeUnknownSync(WatchHistorySearch)
