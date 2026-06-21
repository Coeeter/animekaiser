import type { AnimeItem } from "@workspace/domain"
import { AnimeCard } from "./anime-card"

export function AnimeGrid({ items }: { items: ReadonlyArray<AnimeItem> }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
        No anime found. Try changing your filters.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {items.map((anime) => (
        <AnimeCard key={anime.malId} anime={anime} />
      ))}
    </div>
  )
}
