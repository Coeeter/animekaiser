import { expect, test } from "bun:test"
import { nextForShow } from "./service"

const base = {
  latestEpisode: 5,
  latestStatus: "completed" as const,
  totalEpisodes: 12,
  latestAiredEpisode: 12,
  nextAiringAt: null,
}

test("resumes an unfinished episode", () => {
  expect(nextForShow({ ...base, latestStatus: "watching" })).toEqual({
    _tag: "resume",
    episode: 5,
  })
})

test("offers the following aired episode", () => {
  expect(nextForShow(base)).toEqual({ _tag: "next", episode: 6 })
})

test("is caught up when the next episode has not aired", () => {
  const nextAiringAt = new Date("2026-10-01T00:00:00Z")
  expect(nextForShow({ ...base, latestAiredEpisode: 5, nextAiringAt })).toEqual(
    { _tag: "caughtUp", nextAiringAt }
  )
})

test("is completed after the final episode", () => {
  expect(nextForShow({ ...base, latestEpisode: 12 })).toEqual({
    _tag: "completed",
  })
})
