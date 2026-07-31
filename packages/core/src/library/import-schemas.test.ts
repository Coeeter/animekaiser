import { expect, test } from "bun:test"
import * as Schema from "effect/Schema"
import {
  AniListImportResponse,
  MalImportResponse,
  normalizeAniListImportEntry,
  normalizeLibraryStatus,
  normalizeMalImportEntry,
  sameEntry,
} from "./import"

test("MAL imports decode display metadata and list state", () => {
  const response = Schema.decodeUnknownSync(MalImportResponse)({
    data: [
      {
        node: {
          id: 1,
          title: "Cowboy Bebop",
          alternative_titles: { en: "Cowboy Bebop" },
          main_picture: { large: "https://example.com/cover.webp" },
          num_episodes: 26,
          genres: [{ name: "Action" }, { name: "Sci-Fi" }],
          start_season: { year: 1998 },
        },
        list_status: {
          status: "watching",
          score: 8,
          num_episodes_watched: 3,
          is_rewatching: false,
          comments: "great",
          updated_at: "2024-03-02T10:20:30+00:00",
        },
      },
    ],
    paging: {},
  })
  expect(normalizeMalImportEntry(response.data[0])).toEqual({
    malId: 1,
    aniListId: null,
    aniListEntryId: null,
    titleRomaji: "Cowboy Bebop",
    titleEnglish: "Cowboy Bebop",
    coverImage: "https://example.com/cover.webp",
    episodes: 26,
    status: "watching",
    score: 80,
    progress: 3,
    notes: "great",
    genres: ["Action", "Sci-Fi"],
    seasonYear: 1998,
    updatedAt: new Date("2024-03-02T10:20:30+00:00"),
    createdAt: new Date("2024-03-02T10:20:30+00:00"),
  })
})

test("MAL entries without a source timestamp import with null timestamps", () => {
  const entry = normalizeMalImportEntry({
    node: { id: 5, title: "No timestamp" },
    list_status: {
      status: "completed",
      score: 0,
      num_episodes_watched: 12,
      is_rewatching: false,
    },
  })

  expect(entry.updatedAt).toBeNull()
  expect(entry.createdAt).toBeNull()
  expect(entry.score).toBeNull()
})

test("AniList entries mirror provider unix timestamps", () => {
  const entry = normalizeAniListImportEntry({
    id: 12,
    status: "COMPLETED",
    score: 90,
    progress: 26,
    notes: null,
    updatedAt: 1709375430,
    createdAt: 1700000000,
    media: {
      id: 22,
      idMal: 1,
      title: { romaji: "Cowboy Bebop", english: null },
      coverImage: null,
      episodes: 26,
    },
  })

  expect(entry?.updatedAt).toEqual(new Date(1709375430 * 1000))
  expect(entry?.createdAt).toEqual(new Date(1700000000 * 1000))
})

test("external library statuses map to Kaiser library language", () => {
  expect([
    normalizeLibraryStatus("CURRENT"),
    normalizeLibraryStatus("COMPLETED"),
    normalizeLibraryStatus("PAUSED"),
    normalizeLibraryStatus("DROPPED"),
    normalizeLibraryStatus("REPEATING"),
    normalizeLibraryStatus("PLANNING"),
  ]).toEqual([
    "watching",
    "completed",
    "paused",
    "dropped",
    "rewatching",
    "planning",
  ])
})

test("AniList imports preserve MAL identity and normalize display fields", () => {
  expect(
    normalizeAniListImportEntry({
      id: 12,
      status: "COMPLETED",
      score: 87.6,
      progress: 26,
      notes: "  classic  ",
      media: {
        id: 22,
        idMal: 1,
        title: { romaji: "Cowboy Bebop", english: "Cowboy Bebop" },
        coverImage: { extraLarge: "cover.webp", large: null, medium: null },
        episodes: 26,
      },
    })
  ).toMatchObject({
    malId: 1,
    aniListId: 22,
    aniListEntryId: 12,
    status: "completed",
    score: 88,
    progress: 26,
    notes: "classic",
  })
})

test("AniList imports decode exact nested entries and skip records without MAL identity", () => {
  const response = Schema.decodeUnknownSync(AniListImportResponse)({
    data: {
      MediaListCollection: {
        lists: [
          {
            entries: [
              {
                id: 12,
                status: "CURRENT",
                score: 90,
                progress: 4,
                notes: null,
                media: {
                  id: 22,
                  idMal: null,
                  title: { romaji: "Provider-only identity", english: null },
                  coverImage: null,
                  episodes: null,
                },
              },
            ],
          },
        ],
      },
    },
  })
  const entry =
    response.data?.MediaListCollection?.lists?.[0]?.entries?.[0] ?? null
  expect(normalizeAniListImportEntry(entry)).toBeNull()
})

test("import detects changed AniList entry ids", () => {
  const current = {
    status: "watching",
    score: 80,
    progress: 3,
    notes: null,
    aniListEntryId: 1,
  } as const
  expect(sameEntry(current, { ...current, aniListEntryId: 2 })).toBe(false)
})
