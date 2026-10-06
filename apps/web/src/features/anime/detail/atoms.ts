import type { AnimeItem, LibraryEntry } from "@animekaiser/domain"
import { Atom } from "@effect-atom/atom-react"
import * as Effect from "effect/Effect"
import { KaiserRpcClient } from "../../../services/api-clients"
import { sessionAtom } from "../../auth/atoms"
import { libraryEntriesAtom } from "../../library/atoms"

export const detailAtom = (malId: number) =>
  KaiserRpcClient.query("GetAnimeDetail", { malId })

export const recommendationsAtom = (malId: number) =>
  KaiserRpcClient.query("ListAnimeRecommendations", {
    malId,
    page: 1,
    perPage: 12,
  })

export const watchOrderAtom = (malId: number) =>
  KaiserRpcClient.query(
    "GetAnimeWatchOrder",
    { malId },
    { timeToLive: "10 minutes" }
  )

export type WatchOrderItem = {
  readonly anime: AnimeItem
  readonly entry: LibraryEntry | null
}

export const watchOrderItemsAtom = Atom.family((malId: number) =>
  Atom.make((get) =>
    Effect.gen(function* () {
      const order = yield* get.result(watchOrderAtom(malId))
      const session = yield* get
        .result(sessionAtom)
        .pipe(Effect.orElseSucceed(() => null))
      const entries =
        session && order.entries.length > 1
          ? yield* get
              .result(
                libraryEntriesAtom(order.entries.map((anime) => anime.malId))
              )
              .pipe(Effect.orElseSucceed((): ReadonlyArray<LibraryEntry> => []))
          : []
      const byMalId = new Map(entries.map((entry) => [entry.malId, entry]))
      return order.entries.map(
        (anime): WatchOrderItem => ({
          anime,
          entry: byMalId.get(anime.malId) ?? null,
        })
      )
    })
  )
)
