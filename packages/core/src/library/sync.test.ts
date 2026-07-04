import { expect, test } from "bun:test"
import { malListStatusParams, nextSyncFailureStatus } from "./sync"

const payload = {
  status: "watching",
  score: null,
  progress: 3,
  notes: null,
  aniListId: null,
  aniListEntryId: null,
} as const

test("MAL sync omits score when local score is empty", () => {
  expect(malListStatusParams(payload)).toEqual([
    ["status", "watching"],
    ["num_watched_episodes", "3"],
    ["is_rewatching", "false"],
  ])
})

test("MAL sync sends score only when present", () => {
  expect(malListStatusParams({ ...payload, score: 80 })).toContainEqual([
    "score",
    "8",
  ])
})

test("sync events retry twice before staying failed", () => {
  expect(nextSyncFailureStatus(1)).toBe("pending")
  expect(nextSyncFailureStatus(2)).toBe("pending")
  expect(nextSyncFailureStatus(3)).toBe("failed")
})
