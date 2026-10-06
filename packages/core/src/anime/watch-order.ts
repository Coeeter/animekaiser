import type { AnimeDetail, AnimeFormat } from "@animekaiser/domain"
import * as Effect from "effect/Effect"

type Relation = AnimeDetail["relations"][number]
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
  anime: AnimeDetail,
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

export type WatchOrder = {
  readonly entries: ReadonlyArray<AnimeDetail>
  readonly complete: boolean
}

// Walks prequels back from the starting show and sequels forward from it, so
// the starting show is always on the path even when the franchise branches.
// A failed lookup ends that direction early and marks the order incomplete.
export const buildWatchOrder = <E>(
  start: AnimeDetail,
  lookup: (malId: number) => Effect.Effect<AnimeDetail, E>
) =>
  Effect.gen(function* () {
    const visited = new Set([start.malId])
    const state = { complete: true, hops: 0 }

    const walk = (direction: Direction) =>
      Effect.gen(function* () {
        const found: Array<AnimeDetail> = []
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
    } satisfies WatchOrder
  })
