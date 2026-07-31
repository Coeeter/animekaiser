import { Button } from "@animekaiser/ui/components/button"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@animekaiser/ui/components/sheet"
import { Link, useNavigate } from "@tanstack/react-router"
import { Compass, SlidersHorizontal } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import { PageHero } from "../../../components/page-hero"
import type { CatalogSearch } from "../common/search"
import {
  getActiveFilters,
  SeriesCatalogActiveFilters,
  SeriesCatalogFilters,
} from "./series-catalog-filters"

export function SeriesCatalogLayout({
  search,
  children,
}: {
  search: CatalogSearch
  children: ReactNode
}) {
  const navigate = useNavigate()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const activeFilters = getActiveFilters(search)

  const updateSearch = (next: Partial<CatalogSearch>) => {
    void navigate({
      to: "/series",
      search: {
        ...search,
        ...next,
        page: next.page ?? 1,
      },
    })
  }

  const clearFilter = (key: keyof CatalogSearch) => {
    if (key === "seasonYear") {
      updateSearch({ season: undefined, seasonYear: undefined })
      return
    }
    updateSearch({ [key]: undefined })
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 pb-8 md:p-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="transition hover:text-foreground">
          Home
        </Link>
        <span>/</span>
        <span className="text-foreground">Series</span>
      </nav>

      <PageHero
        icon={Compass}
        kicker="Browse catalog"
        title="Find a series"
        description="Search and filter anime by season, format, score, status, and audience rating."
      >
        {activeFilters.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {activeFilters.length} filter
            {activeFilters.length !== 1 ? "s" : ""} active
          </span>
        ) : null}
      </PageHero>

      <section className="rounded-xl border bg-card/80">
        <div className="flex flex-col gap-4 p-4 md:p-5">
          <div className="md:hidden">
            <div className="flex flex-col gap-4">
              <SeriesCatalogFilters
                search={search}
                updateSearch={updateSearch}
                mode="desktop"
                showAdvanced={false}
                showActions={false}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setMobileFiltersOpen(true)}
              >
                <SlidersHorizontal className="size-4" />
                Filters
                {activeFilters.length > 0 ? ` (${activeFilters.length})` : ""}
              </Button>
            </div>
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetContent side="bottom" showCloseButton={false}>
                <SheetHeader className="pb-3">
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription className="sr-only">
                    Refine your search results.
                  </SheetDescription>
                </SheetHeader>
                <SheetBody className="px-4">
                  <SeriesCatalogFilters
                    search={search}
                    updateSearch={(next) => {
                      setMobileFiltersOpen(false)
                      updateSearch(next)
                    }}
                    mode="sheet"
                    showSearch={false}
                    showActions={false}
                  />
                </SheetBody>
              </SheetContent>
            </Sheet>
          </div>

          <div className="hidden md:block">
            <SeriesCatalogFilters search={search} updateSearch={updateSearch} />
          </div>

          <SeriesCatalogActiveFilters
            search={search}
            clearFilter={clearFilter}
            removeGenre={(genre) => {
              const current = search.genre ? search.genre.split(",") : []
              const next = current.filter((item) => item !== genre)
              updateSearch({
                genre: next.length > 0 ? next.join(",") : undefined,
              })
            }}
          />
        </div>
      </section>

      {children}
    </div>
  )
}
