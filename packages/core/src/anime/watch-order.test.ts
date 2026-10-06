import { describe, expect, it } from "bun:test"
import type { AnimeDetail, AnimeFormat } from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import { buildWatchOrder, watchOrderHopLimit } from "./watch-order"

type Edge = {
  to: number | null
  type: string
  format?: AnimeFormat | null
}

const anime = (
  malId: number,
  edges: ReadonlyArray<Edge> = []
): AnimeDetail => ({
  malId,
  aniListId: malId,
  title: { romaji: `Show ${malId}`, english: null },
  format: "TV",
  status: "FINISHED",
  episodes: 12,
  duration: 24,
  coverImage: null,
  bannerImage: null,
  genres: [],
  averageScore: null,
  popularity: null,
  trending: null,
  season: null,
  seasonYear: null,
  broadcast: null,
  nextAiringEpisode: null,
  isAdult: false,
  description: null,
  synonyms: [],
  tags: [],
  studios: [],
  trailer: null,
  externalLinks: [],
  relations: edges.map((edge) => ({
    malId: edge.to,
    aniListId: null,
    relationType: edge.type,
    title: { romaji: `Show ${edge.to}`, english: null },
    format: edge.format === undefined ? "TV" : edge.format,
    status: "FINISHED",
    coverImage: null,
  })),
})

const graph = (shows: ReadonlyArray<AnimeDetail>) => {
  const byId = new Map(shows.map((show) => [show.malId, show]))
  const lookups: Array<number> = []
  const lookup = (malId: number) => {
    lookups.push(malId)
    const show = byId.get(malId)
    return show ? Effect.succeed(show) : Effect.fail("missing" as const)
  }
  return { lookup, lookups }
}

const orderOf = (start: AnimeDetail, shows: ReadonlyArray<AnimeDetail>) => {
  const { lookup, lookups } = graph(shows)
  const order = Effect.runSync(buildWatchOrder(start, lookup))
  return {
    ids: order.entries.map((entry) => entry.malId),
    complete: order.complete,
    lookups,
  }
}

describe("buildWatchOrder", () => {
  it("orders prequels before and sequels after a middle season", () => {
    const s1 = anime(1, [{ to: 2, type: "SEQUEL" }])
    const s2 = anime(2, [
      { to: 1, type: "PREQUEL" },
      { to: 3, type: "SEQUEL", format: "MOVIE" },
    ])
    const movie = anime(3, [
      { to: 2, type: "PREQUEL" },
      { to: 4, type: "SEQUEL" },
    ])
    const s3 = anime(4, [{ to: 3, type: "PREQUEL" }])

    expect(orderOf(s2, [s1, s2, movie, s3])).toEqual({
      ids: [1, 2, 3, 4],
      complete: true,
      lookups: [1, 3, 4],
    })
  })

  it("ignores side stories, recaps, music, and relations without a MAL ID", () => {
    const s1 = anime(1, [
      { to: 2, type: "SIDE_STORY" },
      { to: 3, type: "SUMMARY" },
      { to: 4, type: "SEQUEL", format: "MUSIC" },
      { to: null, type: "SEQUEL" },
      { to: 5, type: "SEQUEL", format: "SPECIAL" },
    ])
    const special = anime(5, [{ to: 1, type: "PREQUEL" }])

    expect(orderOf(s1, [s1, special]).ids).toEqual([1, 5])
  })

  it("takes the TV sequel over a movie when a season branches", () => {
    const s1 = anime(1, [
      { to: 9, type: "SEQUEL", format: "MOVIE" },
      { to: 7, type: "SEQUEL", format: "OVA" },
      { to: 8, type: "SEQUEL", format: "TV" },
    ])

    expect(orderOf(s1, [s1, anime(7), anime(8), anime(9)]).ids).toEqual([1, 8])
  })

  it("stops at cycles instead of looping", () => {
    const a = anime(1, [
      { to: 2, type: "SEQUEL" },
      { to: 2, type: "PREQUEL" },
    ])
    const b = anime(2, [
      { to: 1, type: "SEQUEL" },
      { to: 1, type: "PREQUEL" },
    ])

    expect(orderOf(a, [a, b])).toEqual({
      ids: [2, 1],
      complete: true,
      lookups: [2],
    })
  })

  it("keeps what it found and marks the order incomplete when a lookup fails", () => {
    const s1 = anime(1, [{ to: 2, type: "SEQUEL" }])
    const s2 = anime(2, [
      { to: 1, type: "PREQUEL" },
      { to: 3, type: "SEQUEL" },
    ])

    expect(orderOf(s1, [s1, s2])).toMatchObject({
      ids: [1, 2],
      complete: false,
    })
  })

  it("stops after the hop limit", () => {
    const shows = Array.from({ length: watchOrderHopLimit + 10 }, (_, index) =>
      anime(index + 1, [{ to: index + 2, type: "SEQUEL" }])
    )

    const [first] = shows
    if (!first) throw new Error("fixture is empty")
    const order = orderOf(first, shows)
    expect(order.ids).toHaveLength(watchOrderHopLimit + 1)
    expect(order.complete).toBe(false)
  })
})
