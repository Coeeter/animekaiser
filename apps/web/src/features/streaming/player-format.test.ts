import { describe, expect, test } from "bun:test"
import {
  formatTime,
  nextStreamServer,
  preferredQualityIndex,
  watchAction,
  watchEpisodeNumber,
} from "./player-format"

describe("preferredQualityIndex", () => {
  const levels = [{ height: 1080 }, { height: 360 }, { height: 720 }]

  test("selects the preferred resolution regardless of manifest order", () => {
    expect(preferredQualityIndex(levels, 1080)).toBe(0)
    expect(preferredQualityIndex(levels, 720)).toBe(2)
    expect(preferredQualityIndex(levels, 360)).toBe(1)
  })

  test("falls back below the preference, then to the lowest available", () => {
    expect(preferredQualityIndex(levels, 480)).toBe(1)
    expect(preferredQualityIndex([{ height: 720 }], 360)).toBe(0)
  })

  test("uses adaptive quality for Auto or unknown resolutions", () => {
    expect(preferredQualityIndex(levels, null)).toBe(-1)
    expect(preferredQualityIndex([], 1080)).toBe(-1)
    expect(preferredQualityIndex([{ height: 0 }], 720)).toBe(-1)
  })
})

describe("formatTime", () => {
  test("includes hours for long media", () => {
    expect(formatTime(65)).toBe("1:05")
    expect(formatTime(3599)).toBe("59:59")
    expect(formatTime(3600)).toBe("1:00:00")
    expect(formatTime(5997)).toBe("1:39:57")
  })
})

describe("watchEpisodeNumber", () => {
  test("starts new viewers at one and resumes after completed progress", () => {
    expect(watchEpisodeNumber(null)).toBe(1)
    expect(watchEpisodeNumber(1)).toBe(1)
    expect(watchEpisodeNumber(2)).toBe(3)
  })
})

describe("watchAction", () => {
  test("rewatches from episode one after every available episode is watched", () => {
    expect(watchAction(12, [1, 2, 12])).toEqual({
      episodeNumber: 1,
      label: "Rewatch Anime",
    })
    expect(watchAction(2, [1, 2, 3])).toEqual({
      episodeNumber: 3,
      label: "Continue Watching",
    })
  })
})

test("advances to the next server with matching audio", () => {
  const servers = [
    { id: "one", name: "One", audio: "sub" as const },
    { id: "dub", name: "Dub", audio: "dub" as const },
    { id: "two", name: "Two", audio: "sub" as const },
  ]
  expect(nextStreamServer(servers, "one", "sub")?.id).toBe("two")
  expect(nextStreamServer(servers, "two", "sub")).toBeNull()
})
