import { expect, test } from "bun:test"
import type { StreamEpisodeCatalog } from "@animekaiser/domain"
import {
  availabilityTtlSeconds,
  resolveAiredEpisode,
  resolveLatestAiredAt,
} from "./service"

const now = new Date("2026-09-27T12:00:00Z")

const anizip = [
  {
    number: 1,
    title: null,
    overview: null,
    image: null,
    airedAt: "2026-09-13T15:00:00Z",
  },
  {
    number: 2,
    title: null,
    overview: null,
    image: null,
    airedAt: "2026-09-20T15:00:00Z",
  },
  {
    number: 3,
    title: null,
    overview: null,
    image: null,
    airedAt: "2026-10-04T15:00:00Z",
  },
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
      anizip: [
        { number: 1, title: null, overview: null, image: "x", airedAt: null },
      ],
      knownEpisodes: 12,
      now,
    })
  ).toBeNull()
})

const catalogWithStatus = (
  status: "available" | "unmatched" | "unavailable"
): StreamEpisodeCatalog =>
  ({
    providers: [{ status, episodes: [] }],
  }) as unknown as StreamEpisodeCatalog

test("availability is cached longest once an episode is out", () => {
  expect(availabilityTtlSeconds(catalogWithStatus("available"), true)).toBe(
    24 * 60 * 60
  )
})

test("a carried show is rechecked every tick until the episode lands", () => {
  expect(availabilityTtlSeconds(catalogWithStatus("available"), false)).toBe(
    9 * 60
  )
})

test("shows the provider doesn't carry and provider errors back off", () => {
  expect(availabilityTtlSeconds(catalogWithStatus("unmatched"), false)).toBe(
    6 * 60 * 60
  )
  expect(availabilityTtlSeconds(catalogWithStatus("unavailable"), false)).toBe(
    30 * 60
  )
})

const episode = (number: number, airedAt: string | null) => ({
  number,
  title: null,
  overview: null,
  image: null,
  airedAt,
})

test("a finished show catching up its episode count is not a new airing", () => {
  // K-ON!: ani.zip dates episodes 1-12 (2009) but not 13, so a sync without
  // AniList stored 12, and the next sync with AniList answered 13.
  const konAniZip = [
    episode(1, "2009-04-02T15:00:00Z"),
    episode(12, "2009-06-18T15:00:00Z"),
    episode(13, null),
  ]
  expect(
    resolveLatestAiredAt({
      resolved: { episode: 13, source: "anilist", airedAt: null },
      airingStatus: "FINISHED",
      prior: {
        airingStatus: "FINISHED",
        latestAiredEpisode: 12,
        latestAiredAt: null,
      },
      anizip: konAniZip,
      now,
    })
  ).toEqual(new Date("2009-06-18T15:00:00Z"))
})

test("a finished show without dated episodes drops a stale recent airing", () => {
  expect(
    resolveLatestAiredAt({
      resolved: { episode: 13, source: "anilist", airedAt: null },
      airingStatus: "FINISHED",
      prior: {
        airingStatus: "FINISHED",
        latestAiredEpisode: 13,
        latestAiredAt: new Date("2026-09-27T11:10:00Z"),
      },
      anizip: [],
      now,
    })
  ).toBeNull()
})

test("an airing show advancing without a date aired since the last sync", () => {
  expect(
    resolveLatestAiredAt({
      resolved: { episode: 5, source: "anilist", airedAt: null },
      airingStatus: "RELEASING",
      prior: {
        airingStatus: "RELEASING",
        latestAiredEpisode: 4,
        latestAiredAt: new Date("2026-09-20T15:00:00Z"),
      },
      anizip: [],
      now,
    })
  ).toEqual(now)
})

test("a finale that just ended an airing show still counts as new", () => {
  expect(
    resolveLatestAiredAt({
      resolved: { episode: 12, source: "anilist", airedAt: null },
      airingStatus: "FINISHED",
      prior: {
        airingStatus: "RELEASING",
        latestAiredEpisode: 11,
        latestAiredAt: new Date("2026-09-20T15:00:00Z"),
      },
      anizip: [],
      now,
    })
  ).toEqual(now)
})
