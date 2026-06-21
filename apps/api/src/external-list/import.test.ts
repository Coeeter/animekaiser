import { expect, test } from "bun:test"
import {
  normalizeAniListImportEntry,
  normalizeMalImportEntry,
} from "@workspace/core/server"

test("normalizes typed provider entries", () => {
  expect(
    normalizeMalImportEntry({
      node: { id: 1, title: "Cowboy Bebop" },
      list_status: {
        status: "watching",
        score: 8,
        num_episodes_watched: 3,
        is_rewatching: false,
      },
    })
  ).toMatchObject({ malId: 1, status: "watching", score: 80, progress: 3 })

  expect(
    normalizeAniListImportEntry({
      id: 2,
      status: "CURRENT",
      score: 75,
      progress: 4,
      notes: null,
      media: {
        id: 1,
        idMal: 1,
        title: { romaji: "Cowboy Bebop", english: "Cowboy Bebop" },
        coverImage: { extraLarge: null, large: null, medium: null },
        episodes: 26,
      },
    })
  ).toMatchObject({
    malId: 1,
    aniListEntryId: 2,
    status: "watching",
    score: 75,
    progress: 4,
  })

  expect(
    normalizeAniListImportEntry({
      id: 3,
      status: "PLANNING",
      score: 0,
      progress: 0,
      notes: null,
      media: {
        id: 2,
        idMal: null,
        title: { romaji: "No MAL ID", english: null },
        coverImage: null,
        episodes: null,
      },
    })
  ).toBeNull()
})
