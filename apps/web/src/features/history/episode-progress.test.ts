import { expect, test } from "bun:test"
import type { WatchHistoryEntry } from "@animekaiser/domain"
import { episodeProgressByNumber } from "./episode-progress"

const entry = (
  episode: number,
  positionSeconds: number,
  durationSeconds: number | null,
  status: WatchHistoryEntry["status"] = "watching"
): WatchHistoryEntry => ({
  malId: 1,
  provider: "provider-a",
  episodeId: `ep-${episode}`,
  serverId: null,
  serverName: null,
  episode,
  audio: "sub",
  positionSeconds,
  durationSeconds,
  status,
  updatedAt: new Date(0),
})

test("library progress marks earlier episodes watched and the next one up next", () => {
  const progress = episodeProgressByNumber({
    episodeNumbers: [1, 2, 3],
    entries: [],
    libraryProgress: 2,
  })

  expect(progress.get(1)).toEqual({
    watched: true,
    continueWatching: false,
    progressPercent: 100,
    upNext: false,
  })
  expect(progress.get(3)?.upNext).toBe(true)
})

test("watch history drives the per episode progress bar", () => {
  const progress = episodeProgressByNumber({
    episodeNumbers: [1, 2],
    entries: [entry(1, 300, 1200), entry(2, 5, 1200)],
    libraryProgress: null,
  })

  expect(progress.get(1)).toEqual({
    watched: false,
    continueWatching: true,
    progressPercent: 25,
    upNext: true,
  })
  expect(progress.get(2)?.continueWatching).toBe(false)
})

test("completed history counts as watched even without library progress", () => {
  const progress = episodeProgressByNumber({
    episodeNumbers: [1, 2],
    entries: [entry(1, 1180, 1200, "completed")],
    libraryProgress: null,
  })

  expect(progress.get(1)?.watched).toBe(true)
  expect(progress.get(1)?.progressPercent).toBe(100)
  expect(progress.get(2)?.upNext).toBe(true)
})

test("a fully watched season leaves nothing up next", () => {
  const progress = episodeProgressByNumber({
    episodeNumbers: [1, 2],
    entries: [],
    libraryProgress: 2,
  })

  expect([...progress.values()].some((state) => state.upNext)).toBe(false)
})

test("episodes without history or library progress stay untouched", () => {
  const progress = episodeProgressByNumber({
    episodeNumbers: [2, 1],
    entries: [],
    libraryProgress: null,
  })

  expect(progress.get(1)).toEqual({
    watched: false,
    continueWatching: false,
    progressPercent: 0,
    upNext: true,
  })
  expect(progress.get(2)?.upNext).toBe(false)
})
