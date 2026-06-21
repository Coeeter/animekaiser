import { expect, test } from "bun:test"
import {
  normalizeAniListImportEntry,
  normalizeMalImportEntry,
} from "@workspace/core/server"

test("normalizes typed provider entries", () => {
  expect(
    normalizeMalImportEntry({
      node: { id: 1 },
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
      media: { idMal: 1 },
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
      media: { idMal: null },
    })
  ).toBeNull()
})
