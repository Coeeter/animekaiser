import { LibrarySort, LibraryStatus } from "@animekaiser/domain"
import * as Schema from "effect/Schema"

const PositivePage = Schema.Union(Schema.Number, Schema.NumberFromString).pipe(
  Schema.int(),
  Schema.positive()
)

export const MyListSearch = Schema.Struct({
  status: Schema.optionalWith(
    Schema.Union(Schema.Literal("all"), LibraryStatus),
    { default: () => "all" }
  ),
  sort: Schema.optionalWith(LibrarySort, { default: () => "updated_desc" }),
  page: Schema.optionalWith(PositivePage, { default: () => 1 }),
})
export type MyListSearch = typeof MyListSearch.Type

export const SyncActivitySearch = Schema.Struct({
  page: Schema.optionalWith(PositivePage, { default: () => 1 }),
})
export type SyncActivitySearch = typeof SyncActivitySearch.Type

export const decodeMyListSearch = Schema.decodeUnknownSync(MyListSearch)
export const decodeSyncActivitySearch =
  Schema.decodeUnknownSync(SyncActivitySearch)
