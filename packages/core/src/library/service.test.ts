import { expect, test } from "bun:test"
import { calculateLibraryStats } from "./service"

test("library statistics include empty statuses and average scored entries", () => {
  expect(
    calculateLibraryStats([
      { status: "watching", score: 80 },
      { status: "watching", score: null },
      { status: "completed", score: 95 },
    ])
  ).toEqual({
    total: 3,
    byStatus: {
      watching: 2,
      completed: 1,
      paused: 0,
      dropped: 0,
      planning: 0,
      rewatching: 0,
    },
    meanScore: 88,
  })
})
