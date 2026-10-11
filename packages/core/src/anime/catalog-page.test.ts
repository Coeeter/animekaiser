import { expect, test } from "bun:test"
import * as Schema from "effect/Schema"
import { catalogPageSchema } from "./catalog-page"

const request = { page: 1, perPage: 24, sort: "popularity" as const }
const empty = { items: [], page: 1, perPage: 24, hasNextPage: false }

test("rejects the empty default Browse response, including cached data", () => {
  expect(() =>
    Schema.decodeUnknownSync(catalogPageSchema(request))(empty)
  ).toThrow()
})

test("allows empty search results, filtered catalogs, and later pages", () => {
  for (const filters of [
    { query: "no matching title" },
    { status: "upcoming" as const },
    { format: "MOVIE" as const },
    { genres: ["Comedy"] },
    { season: "WINTER" as const },
    { seasonYear: 2200 },
    { rating: "g" as const },
    { minScore: 0 },
    { maxScore: 0 },
    { studio: "Unknown studio" },
    { page: 2 },
  ]) {
    expect(
      Schema.decodeUnknownSync(catalogPageSchema({ ...request, ...filters }))(
        empty
      )
    ).toEqual(empty)
  }
})
