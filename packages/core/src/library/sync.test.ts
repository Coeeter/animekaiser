import { expect, test } from "bun:test"
import {
  aniListSaveMutation,
  malListStatusParams,
  nextSyncFailureStatus,
} from "./sync"

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

test("rewatching syncs with provider-specific statuses and notes", () => {
  const rewatching = {
    ...payload,
    status: "rewatching" as const,
    notes: "round two",
  }
  expect(malListStatusParams(rewatching)).toContainEqual([
    "is_rewatching",
    "true",
  ])
  expect(malListStatusParams(rewatching)).toContainEqual([
    "comments",
    "round two",
  ])
  expect(aniListSaveMutation(22, rewatching).variables.status).toBe("REPEATING")
})

test("AniList sync omits score when local score is empty", () => {
  const mutation = aniListSaveMutation(22, payload)

  expect(mutation.query).not.toContain("$score")
  expect(mutation.query).not.toContain("score:")
  expect(mutation.variables).not.toHaveProperty("score")
})

test("AniList sync sends score only when present", () => {
  const mutation = aniListSaveMutation(22, { ...payload, score: 80 })

  expect(mutation.query).toContain("$score:Float!")
  expect(mutation.query).toContain("score:$score")
  expect(mutation.variables).toMatchObject({ score: 8 })
})

test("sync events retry twice before staying failed", () => {
  expect(nextSyncFailureStatus(1)).toBe("pending")
  expect(nextSyncFailureStatus(2)).toBe("pending")
  expect(nextSyncFailureStatus(3)).toBe("failed")
})
