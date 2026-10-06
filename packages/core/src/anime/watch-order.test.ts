import { describe, expect, it } from "bun:test"
import type { AnimeDetail, AnimeFormat } from "@animekaiser/domain"
import * as Effect from "effect/Effect"
import {
  buildWatchOrder,
  franchiseStoryNodes,
  storyComponent,
  watchOrderHopLimit,
} from "./watch-order"

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

describe("franchise graphs", () => {
  const link = (source: number, target: number, relation: string) => ({
    source_id: source,
    target_id: target,
    relation,
  })
  const item = (malId: number, format: AnimeFormat = "TV") => ({
    malId,
    format,
  })

  // JJK 0 (film) → S1 → S2 → S3, with a recap and a spin-off hanging off S2.
  const links = [
    link(48561, 40748, "sequel"),
    link(40748, 48561, "prequel"),
    link(40748, 51009, "sequel"),
    link(51009, 40748, "prequel"),
    link(51009, 57658, "sequel"),
    link(57658, 51009, "prequel"),
    link(51009, 56243, "summary"),
    link(51009, 99999, "spin_off"),
  ]

  it("keeps only shows joined to the start by story links", () => {
    expect(storyComponent(links, 51009).sort()).toEqual(
      [40748, 48561, 51009, 57658].sort()
    )
  })

  it("orders the story through the franchise graph", () => {
    const nodes = franchiseStoryNodes(links, [
      item(48561, "MOVIE"),
      item(40748),
      item(51009),
      item(57658),
    ])
    const start = nodes.get(51009)
    if (!start) throw new Error("start is missing")
    const order = Effect.runSync(
      buildWatchOrder(start, (malId) => {
        const node = nodes.get(malId)
        return node ? Effect.succeed(node) : Effect.fail("missing")
      })
    )
    expect(order.entries.map((entry) => entry.malId)).toEqual([
      48561, 40748, 51009, 57658,
    ])
    expect(order.complete).toBe(true)
  })

  it("drops links to shows without data instead of stopping at them", () => {
    const nodes = franchiseStoryNodes(links, [item(40748), item(51009)])
    expect(nodes.get(51009)?.relations).toEqual([
      { malId: 40748, relationType: "PREQUEL", format: "TV" },
    ])
  })
})
