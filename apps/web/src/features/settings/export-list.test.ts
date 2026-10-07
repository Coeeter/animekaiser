import { expect, test } from "bun:test"
import type { LibraryEntry } from "@animekaiser/domain"
import { toMalXml } from "./export-list"

const entry = (overrides: Partial<LibraryEntry>): LibraryEntry =>
  ({
    malId: 52991,
    status: "watching",
    score: 85,
    progress: 12,
    notes: null,
    aniListEntryId: null,
    anime: {
      malId: 52991,
      aniListId: 154587,
      title: { romaji: "Sousou no Frieren", english: "Frieren" },
      coverImage: null,
      episodes: 28,
    },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  }) as LibraryEntry

test("exports entries in MyAnimeList's import format", () => {
  const xml = toMalXml([
    entry({}),
    entry({ malId: 21, status: "paused", score: null, progress: 0 }),
  ])

  expect(xml).toContain("<user_total_anime>2</user_total_anime>")
  expect(xml).toContain("<series_animedb_id>52991</series_animedb_id>")
  expect(xml).toContain("<my_score>9</my_score>")
  expect(xml).toContain("<my_status>Watching</my_status>")
  expect(xml).toContain("<my_status>On-Hold</my_status>")
  expect(xml).toContain("<my_score>0</my_score>")
})

test("keeps notes containing CDATA terminators intact", () => {
  const xml = toMalXml([entry({ notes: "best ]]> show" })])

  expect(xml).toContain(
    "<my_comments><![CDATA[best ]]]]><![CDATA[> show]]></my_comments>"
  )
})
