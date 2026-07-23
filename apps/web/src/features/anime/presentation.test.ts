import { expect, test } from "bun:test"
import { formatAnimeMeta } from "./format"
import { catalogInput, decodeCatalogSearch } from "./search"
import { getAnimeSubtitle, getAnimeTitle } from "./title"

test("anime title preferences retain a distinct alternate title", () => {
  const title = { romaji: "Kimetsu no Yaiba", english: "Demon Slayer" }
  expect(getAnimeTitle(title, "english")).toBe("Demon Slayer")
  expect(getAnimeSubtitle(title, "english")).toBe("Kimetsu no Yaiba")
  expect(getAnimeTitle({ romaji: "Frieren", english: null }, "english")).toBe(
    "Frieren"
  )
})

test("catalog search decodes defaults and normalizes query input", () => {
  expect(
    catalogInput(
      decodeCatalogSearch({ q: "  demon slayer ", genre: "Action, Fantasy" })
    )
  ).toMatchObject({
    query: "demon slayer",
    page: 1,
    perPage: 24,
    sort: "popularity",
    genres: ["Action", "Fantasy"],
  })
})

test("anime metadata presents format, release status, and episode count", () => {
  expect(formatAnimeMeta("TV_SHORT", "RELEASING", 12)).toBe(
    "TV Short · Airing · 12 eps"
  )
})
