import { expect, test } from "bun:test"
import {
  type StreamProviderEpisodes,
  StreamProviderId,
} from "@animekaiser/domain"
import { matchingSourceEpisode } from "./source-selection"

const catalog: StreamProviderEpisodes = {
  provider: StreamProviderId.make("another-provider"),
  label: "Another provider",
  providerAnimeId: "title-123",
  matchedTitle: "Example",
  status: "available",
  message: null,
  episodes: [1, 2, 2.5].map((number) => ({
    id: `provider-specific-${number}`,
    number,
    title: `Episode ${number}`,
    japaneseTitle: null,
    availableAudio: number === 1 ? ["sub", "dub"] : ["sub"],
    updatedAt: null,
    image: null,
    description: null,
  })),
}

test("changing provider matches the episode number rather than the provider's episode ID", () => {
  expect(matchingSourceEpisode(catalog, 2, "sub")?.id).toBe(
    "provider-specific-2"
  )
  expect(matchingSourceEpisode(catalog, 2.5, "sub")?.number).toBe(2.5)
})

test("a source never substitutes another episode or audio edition", () => {
  expect(matchingSourceEpisode(catalog, 3, "sub")).toBeNull()
  expect(matchingSourceEpisode(catalog, 2, "dub")).toBeNull()
  expect(matchingSourceEpisode(catalog, 1, "dub")?.number).toBe(1)
})

test("unmatched and unavailable providers cannot supply an episode", () => {
  expect(matchingSourceEpisode(undefined, 1, "sub")).toBeNull()
  expect(
    matchingSourceEpisode({ ...catalog, status: "unavailable" }, 1, "sub")
  ).toBeNull()
  expect(
    matchingSourceEpisode({ ...catalog, status: "unmatched" }, 1, "sub")
  ).toBeNull()
})
