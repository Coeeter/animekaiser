import { LibrarySort, LibraryStatus } from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

const PositivePage = Schema.Union([
  Schema.Number,
  Schema.NumberFromString,
]).check(Schema.isInt(), Schema.isGreaterThan(0))

export const MyListSearch = Schema.Struct({
  status: Schema.Union([Schema.Literal("all"), LibraryStatus]).pipe(
    Schema.withDecodingDefaultType(Effect.succeed("all"))
  ),
  q: Schema.optional(Schema.String),
  sort: LibrarySort.pipe(
    Schema.withDecodingDefaultType(Effect.succeed("updated_desc"))
  ),
  page: PositivePage.pipe(Schema.withDecodingDefaultType(Effect.succeed(1))),
})
export type MyListSearch = typeof MyListSearch.Type

export const SyncActivitySearch = Schema.Struct({
  page: PositivePage.pipe(Schema.withDecodingDefaultType(Effect.succeed(1))),
})
export type SyncActivitySearch = typeof SyncActivitySearch.Type

export const decodeMyListSearch = Schema.decodeUnknownSync(MyListSearch)
export const decodeSyncActivitySearch =
  Schema.decodeUnknownSync(SyncActivitySearch)
