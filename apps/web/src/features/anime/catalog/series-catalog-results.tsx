import type { AnimePage } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { Link } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { AnimeGrid } from "../common/anime-grid"
import type { CatalogSearch } from "../common/search"
import { getSortLabel } from "./series-catalog-filters"

export function SeriesCatalogResults({
  page,
  search,
}: {
  page: AnimePage
  search: CatalogSearch
}) {
  const sortLabel = getSortLabel(search.sort)

  return (
    <>
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold tracking-tight">
            Results
          </h2>
          <span className="text-sm text-muted-foreground">
            Sorted by {sortLabel.toLowerCase()}
          </span>
        </div>

        <AnimeGrid items={page.items} />
      </section>

      <div className="flex items-center justify-between gap-3 rounded-xl border bg-card/80 p-3">
        {search.page <= 1 ? (
          <Button variant="outline" disabled>
            <ChevronLeft className="size-4" />
            Previous
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link to="/series" search={{ ...search, page: search.page - 1 }}>
              <ChevronLeft className="size-4" />
              Previous
            </Link>
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          Page{" "}
          <span className="font-medium text-foreground">{search.page}</span>
        </span>
        {!page.hasNextPage ? (
          <Button variant="outline" disabled>
            Next
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link to="/series" search={{ ...search, page: search.page + 1 }}>
              Next
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        )}
      </div>
    </>
  )
}
