import { expect, test } from "bun:test"
import * as Schema from "effect/Schema"
import {
  AniListImportResponse,
  MalImportResponse,
  normalizeAniListImportEntry,
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
        },
        list_status: {
          status: "watching",
          score: 8,
          num_episodes_watched: 3,
          is_rewatching: false,
          comments: "great",
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
