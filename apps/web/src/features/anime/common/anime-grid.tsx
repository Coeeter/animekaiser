import type { AnimeItem } from "@animekaiser/domain"
import { AnimeCard } from "./anime-card"

export function AnimeGrid({
  items,
  compact = false,
}: {
  items: ReadonlyArray<AnimeItem>
  compact?: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No anime matched the current filters.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {items.map((anime) => (
        <AnimeCard key={anime.malId} anime={anime} compact={compact} />
      ))}
    </div>
  )
}
