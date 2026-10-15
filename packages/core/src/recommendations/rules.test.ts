import { describe, expect, test } from "bun:test"
import type { AnimeItem } from "@animekaiser/domain"
import { filterCandidates, fitsBudget, supportedUrls } from "./rules"

const anime = (overrides: Partial<AnimeItem>): AnimeItem => ({
  malId: 1,
  aniListId: null,
  title: { romaji: "Title", english: null },
  format: "TV",
  status: "FINISHED",
  episodes: 12,
  duration: 24,
  coverImage: null,
  bannerImage: null,
  genres: ["Drama"],
  averageScore: 80,
  popularity: 1,
  trending: null,
  season: null,
  seasonYear: 2020,
  broadcast: null,
  nextAiringEpisode: null,
  isAdult: false,
  ...overrides,
})

describe("filterCandidates", () => {
  const criteria = {
    genres: [],
    excludeGenres: ["Horror"],
    formats: ["MOVIE"],
    maxEpisodes: 1,
  }
  test("applies hard filters, excludes watched and duplicates", () => {
    const result = filterCandidates(
      [
        anime({ malId: 1, format: "MOVIE", episodes: 1 }),
        anime({ malId: 1, format: "MOVIE", episodes: 1 }),
        anime({ malId: 2, format: "TV" }),
        anime({ malId: 3, format: "MOVIE", genres: ["Horror"] }),
        anime({ malId: 4, format: "MOVIE", episodes: 1 }),
        anime({ malId: 5, format: "MOVIE", episodes: 1, isAdult: true }),
      ],
      criteria,
      new Set([4])
    )
    expect(result.map((entry) => entry.candidate.malId)).toEqual([1])
  })

  test("keeps unknown metadata with a label instead of passing silently", () => {
    const [entry] = filterCandidates(
      [anime({ malId: 9, format: null, episodes: null })],
      criteria,
      new Set()
    )
    expect(entry?.notes).toEqual(["Format unknown", "Episode count unknown"])
  })
})

describe("supportedUrls", () => {
  test("accepts only URLs the provider cited", () => {
    expect(
      supportedUrls(
        ["https://www.example.com/ep1/#x", "https://invented.example/ep2"],
        ["https://example.com/ep1"]
      )
    ).toEqual(["https://example.com/ep1"])
  })
  test("rejects non-http schemes", () => {
    expect(
      supportedUrls(["javascript:alert(1)"], ["javascript:alert(1)"])
    ).toEqual([])
  })
})

describe("fitsBudget", () => {
  test("counts reservations and spend against the monthly cap", () => {
    expect(fitsBudget({ reservedUsd: 9.9, spentUsd: 0 }, 0.1)).toBe(true)
    expect(fitsBudget({ reservedUsd: 9.9, spentUsd: 0.01 }, 0.1)).toBe(false)
  })
})
