import { describe, expect, test } from "bun:test"
import {
  acceptedSegment,
  coveredSeconds,
  isCoverageComplete,
  mergeIntervals,
} from "./coverage"

describe("mergeIntervals", () => {
  test("merges overlapping and adjacent ranges without double counting", () => {
    const merged = mergeIntervals(
      mergeIntervals(mergeIntervals([], [0, 10]), [20, 30]),
      [5, 20]
    )
    expect(merged).toEqual([[0, 30]])
    expect(coveredSeconds(mergeIntervals(merged, [10, 25]))).toBe(30)
  })

  test("keeps disjoint ranges ordered", () => {
    expect(mergeIntervals([[40, 50]], [0, 5])).toEqual([
      [0, 5],
      [40, 50],
    ])
  })
})

describe("acceptedSegment", () => {
  const base = {
    fromSeconds: 100,
    clientElapsedMs: 5_000,
    serverElapsedMs: 5_000,
    rate: 1,
    durationSeconds: 1400,
  }

  test("accepts continuous playback", () => {
    expect(acceptedSegment({ ...base, toSeconds: 105 })).toEqual([100, 105])
  })

  test("rejects a seek disguised as viewing", () => {
    expect(acceptedSegment({ ...base, toSeconds: 400 })).toBeNull()
  })

  test("bounds a client that overstates elapsed time by server time", () => {
    expect(
      acceptedSegment({
        ...base,
        clientElapsedMs: 60_000,
        serverElapsedMs: 4_000,
        toSeconds: 150,
      })
    ).toBeNull()
  })

  test("allows faster shared speed", () => {
    expect(acceptedSegment({ ...base, rate: 2, toSeconds: 110 })).toEqual([
      100, 110,
    ])
  })

  test("clamps to the episode duration and rejects reversed ranges", () => {
    expect(
      acceptedSegment({ ...base, fromSeconds: 1398, toSeconds: 1403 })
    ).toEqual([1398, 1400])
    expect(acceptedSegment({ ...base, toSeconds: 90 })).toBeNull()
  })
})

describe("isCoverageComplete", () => {
  test("requires 92% of a known duration", () => {
    expect(isCoverageComplete([[0, 91]], 100)).toBe(false)
    expect(
      isCoverageComplete(
        [
          [0, 50],
          [58, 100],
        ],
        100
      )
    ).toBe(true)
    expect(isCoverageComplete([[0, 100]], null)).toBe(false)
  })
})
