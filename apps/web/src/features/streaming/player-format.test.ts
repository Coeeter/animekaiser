import { describe, expect, test } from "bun:test"
import {
  nextStreamServer,
  watchAction,
  watchEpisodeNumber,
} from "./player-format"

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
