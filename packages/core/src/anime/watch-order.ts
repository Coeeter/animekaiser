import type { AnimeFormat } from "@animekaiser/domain"
import * as Effect from "effect/Effect"

type Relation = {
  readonly malId: number | null
  readonly relationType: string
  readonly format: AnimeFormat | null
}
export type StoryNode = {
  readonly malId: number
  readonly relations: ReadonlyArray<Relation>
}
type Direction = "PREQUEL" | "SEQUEL"

export const watchOrderHopLimit = 30

const formatRank: ReadonlyArray<AnimeFormat> = [
  "TV",
  "ONA",
  "TV_SHORT",
  "MOVIE",
  "OVA",
  "SPECIAL",
]

const rankOf = (format: AnimeFormat | null) => {
  const index = format ? formatRank.indexOf(format) : -1
  return index === -1 ? formatRank.length : index
}

const relationKind = (relation: Relation) =>
  relation.relationType.trim().replace(/[\s-]/g, "_").toUpperCase()

export const nextStoryRelation = (
  anime: StoryNode,
  direction: Direction,
  visited: ReadonlySet<number>
) =>
  anime.relations
    .filter(
      (relation): relation is Relation & { malId: number } =>
        relationKind(relation) === direction &&
        relation.malId !== null &&
        relation.format !== "MUSIC" &&
        !visited.has(relation.malId)
    )
    .sort(
      (left, right) =>
        rankOf(left.format) - rankOf(right.format) || left.malId - right.malId
    )
    .at(0) ?? null

export type WatchOrder<Node extends StoryNode> = {
  readonly entries: ReadonlyArray<Node>
  readonly complete: boolean
}

// Walks prequels back from the starting show and sequels forward from it, so
// the starting show is always on the path even when the franchise branches.
// A failed lookup ends that direction early and marks the order incomplete.
export const buildWatchOrder = <Node extends StoryNode, E>(
  start: Node,
  lookup: (malId: number) => Effect.Effect<Node, E>
) =>
  Effect.gen(function* () {
    const visited = new Set([start.malId])
    const state = { complete: true, hops: 0 }

    const walk = (direction: Direction) =>
      Effect.gen(function* () {
        const found: Array<Node> = []
        let current = start
        while (state.hops < watchOrderHopLimit) {
          const relation = nextStoryRelation(current, direction, visited)
          if (!relation) return found
          visited.add(relation.malId)
          state.hops += 1
          const next = yield* lookup(relation.malId).pipe(Effect.option)
          if (next._tag === "None") {
            state.complete = false
            return found
          }
          found.push(next.value)
          current = next.value
        }
        state.complete = false
        return found
      })

    const prequels = yield* walk("PREQUEL")
    const sequels = yield* walk("SEQUEL")

    return {
      entries: [...prequels.reverse(), start, ...sequels],
      complete: state.complete,
    } satisfies WatchOrder<Node>
  })

type FranchiseLink = {
  readonly source_id: number
  readonly target_id: number
  readonly relation: string
}

const isStoryLink = (link: FranchiseLink) =>
  link.relation === "prequel" || link.relation === "sequel"

// Only shows joined to the start by prequel/sequel links can be on its watch
// order, so the rest of a large franchise never needs looking up.
export const storyComponent = (
  links: ReadonlyArray<FranchiseLink>,
  start: number
) => {
  const neighbours = new Map<number, Array<number>>()
  for (const link of links.filter(isStoryLink)) {
    neighbours.set(link.source_id, [
      ...(neighbours.get(link.source_id) ?? []),
      link.target_id,
    ])
    neighbours.set(link.target_id, [
      ...(neighbours.get(link.target_id) ?? []),
      link.source_id,
    ])
  }
  const seen = new Set([start])
  const queue = [start]
  for (
    let current = queue.shift();
    current !== undefined;
    current = queue.shift()
  ) {
    for (const next of neighbours.get(current) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return [...seen]
}

// Turns franchise links into story nodes for the shows we have data for;
// links to anything else (adult, music, unknown to AniList) are dropped.
export const franchiseStoryNodes = <
  Item extends { readonly malId: number; readonly format: AnimeFormat | null },
>(
  links: ReadonlyArray<FranchiseLink>,
  items: ReadonlyArray<Item>
) => {
  const byId = new Map(items.map((item) => [item.malId, item]))
  return new Map(
    items.map((item) => [
      item.malId,
      {
        malId: item.malId,
        item,
        relations: links.flatMap((link) => {
          const target = byId.get(link.target_id)
          return link.source_id === item.malId && isStoryLink(link) && target
            ? [
                {
                  malId: target.malId,
                  relationType: link.relation.toUpperCase(),
                  format: target.format,
                },
              ]
            : []
        }),
      },
    ])
  )
}
