import { expect, test } from "bun:test"
import { calculateStreaks, scoreBucket } from "./stats-service"

const today = new Date("2026-07-31T12:00:00Z")

test("no activity yields no streak", () => {
  expect(calculateStreaks(new Set(), today)).toEqual({ current: 0, longest: 0 })
})

test("consecutive days ending today count as a live streak", () => {
  const days = new Set(["2026-07-29", "2026-07-30", "2026-07-31"])
  expect(calculateStreaks(days, today)).toEqual({ current: 3, longest: 3 })
})

test("a streak ending yesterday is still live", () => {
  const days = new Set(["2026-07-29", "2026-07-30"])
  expect(calculateStreaks(days, today)).toEqual({ current: 2, longest: 2 })
})

test("a lapsed streak reports zero current but keeps the longest", () => {
  const days = new Set(["2026-07-01", "2026-07-02", "2026-07-03"])
  expect(calculateStreaks(days, today)).toEqual({ current: 0, longest: 3 })
})

test("gaps split streaks and the longest run wins", () => {
  const days = new Set([
    "2026-07-01",
    "2026-07-02",
    "2026-07-03",
    "2026-07-04",
    "2026-07-20",
  ])
  expect(calculateStreaks(days, today).longest).toBe(4)
})

test("stored 0-100 scores bucket into the 1-10 rating scale", () => {
  expect([scoreBucket(100), scoreBucket(85), scoreBucket(10)]).toEqual([
    10, 9, 1,
  ])
})

test("score buckets never fall outside 1-10", () => {
  expect([scoreBucket(0), scoreBucket(4), scoreBucket(200)]).toEqual([1, 1, 10])
})
