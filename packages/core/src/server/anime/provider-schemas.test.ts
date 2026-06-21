import { expect, test } from "bun:test"
import * as Schema from "effect/Schema"
import { AniListPageResponse } from "./anilist"
import { JikanListResponse } from "./jikan"

test("decodes the AniList catalog fields consumed by normalization", () => {
  const response = Schema.decodeUnknownSync(AniListPageResponse)({
    data: {
      Page: {
        pageInfo: { hasNextPage: false },
        media: [
          {
            id: 1,
            idMal: 1,
            title: { romaji: "Cowboy Bebop", english: "Cowboy Bebop" },
            format: "TV",
            status: "FINISHED",
            episodes: 26,
            duration: 24,
            coverImage: {
              extraLarge: "https://example.com/cover.webp",
              large: null,
              medium: null,
            },
            bannerImage: null,
            genres: ["Action"],
            averageScore: 86,
            popularity: 200_000,
            trending: 10,
            season: "SPRING",
            seasonYear: 1998,
            nextAiringEpisode: null,
            isAdult: false,
          },
        ],
      },
    },
  })
  expect(response.data?.Page?.media?.[0]?.idMal).toBe(1)
})

test("rejects malformed AniList catalog fields", () => {
  expect(() =>
    Schema.decodeUnknownSync(AniListPageResponse)({
      data: {
        Page: { pageInfo: { hasNextPage: false }, media: [{ id: "1" }] },
      },
    })
  ).toThrow()
})

test("decodes nullable Jikan fields without an opaque payload", () => {
  const response = Schema.decodeUnknownSync(JikanListResponse)({
    data: [
      {
        mal_id: 1,
        title: "Cowboy Bebop",
        title_english: null,
        type: "TV",
        status: "Finished Airing",
        episodes: null,
        duration: null,
        images: {
          webp: {
            large_image_url: null,
            image_url: null,
            small_image_url: null,
          },
        },
        genres: [],
        score: null,
        season: null,
        year: null,
        rating: null,
      },
    ],
    pagination: { has_next_page: false },
  })
  expect(response.data[0]?.mal_id).toBe(1)
})
