import type { AnimeItem } from "@animekaiser/domain"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@animekaiser/ui/components/empty"
import { SearchX } from "lucide-react"
import { AnimeCard } from "./anime-card"

export function AnimeGrid({
  items,
  emptyTitle = "Nothing matched",
  emptyDescription = "Try removing a filter or widening your search.",
}: {
  items: ReadonlyArray<AnimeItem>
  emptyTitle?: string
  emptyDescription?: string
}) {
  if (items.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:gap-x-4 md:gap-y-6 lg:grid-cols-6">
      {items.map((anime) => (
        <AnimeCard key={anime.malId} anime={anime} />
      ))}
    </div>
  )
}
