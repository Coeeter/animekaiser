import { expect, test } from "bun:test"
import { resolveAiredEpisode } from "./service"

const now = new Date("2026-09-27T12:00:00Z")

const anizip = [
  { number: 1, image: null, airedAt: "2026-09-13T15:00:00Z" },
  { number: 2, image: null, airedAt: "2026-09-20T15:00:00Z" },
  { number: 3, image: null, airedAt: "2026-10-04T15:00:00Z" },
]

test("prefers AniList's next airing episode over ani.zip air dates", () => {
  expect(
    resolveAiredEpisode({
      anilist: {
        malId: 1,
        status: "RELEASING",
        episodes: 12,
        nextAiringEpisode: { episode: 4, airingAt: 1_790_000_000 },
      },
      anizip,
      knownEpisodes: 12,
      now,
    })
  ).toEqual({ episode: 3, source: "anilist", airedAt: null })
})

test("falls back to ani.zip air dates when AniList has no schedule", () => {
  expect(
    resolveAiredEpisode({
      anilist: {
        malId: 1,
        status: "RELEASING",
        episodes: null,
        nextAiringEpisode: null,
      },
      anizip,
      knownEpisodes: null,
      now,
    })
  ).toEqual({
    episode: 2,
    source: "anizip",
    airedAt: new Date("2026-09-20T15:00:00Z"),
  })
})

test("uses the known episode count for finished anime without an AniList count", () => {
  expect(
    resolveAiredEpisode({
      anilist: {
        malId: 1,
        status: "FINISHED",
        episodes: null,
        nextAiringEpisode: null,
      },
      anizip: [],
      knownEpisodes: 24,
      now,
    })
  ).toEqual({ episode: 24, source: "metadata", airedAt: null })
})

test("reports nothing when no source knows the airing state", () => {
  expect(
    resolveAiredEpisode({
      anilist: undefined,
      anizip: [{ number: 1, image: "x", airedAt: null }],
      knownEpisodes: 12,
      now,
    })
  ).toBeNull()
})
