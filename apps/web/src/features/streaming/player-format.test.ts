import { describe, expect, test } from "bun:test"
import { watchEpisodeNumber } from "./player-format"

describe("watchEpisodeNumber", () => {
  test("starts new viewers at one and resumes after completed progress", () => {
    expect(watchEpisodeNumber(null)).toBe(1)
    expect(watchEpisodeNumber(1)).toBe(1)
    expect(watchEpisodeNumber(2)).toBe(3)
  })
})
