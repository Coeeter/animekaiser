import type { AnimeDiscoveryCategory, AnimeSort } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@animekaiser/ui/components/tabs"
import { Result, useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import type { ReactNode } from "react"
import { DataError } from "../../../components/data-error"
import { PageHero } from "../../../components/page-hero"
import { AnimeGrid } from "../common/anime-grid"
import type { DiscoverSearch } from "../common/search"
import { discoveryAtom } from "./atoms"

const tabTitles: Record<AnimeDiscoveryCategory, string> = {
  trending: "Trending now",
  seasonal: "Current season",
  popular: "Popular",
  topRated: "Top rated",
  upcoming: "Upcoming",
}

const tabLabels: Record<AnimeDiscoveryCategory, string> = {
  trending: "Trending",
  seasonal: "Seasonal",
  popular: "Popular",
  topRated: "Top Rated",
  upcoming: "Upcoming",
}

const tabDescriptions: Record<AnimeDiscoveryCategory, string> = {
  trending: "Fast-moving titles with the most current attention.",
  seasonal: "Shows airing in the current anime season.",
  popular: "Catalog favorites with broad audience reach.",
  topRated: "High-scoring releases across the catalog.",
  upcoming: "Announced titles coming up next.",
}

const catalogSort: Partial<Record<AnimeDiscoveryCategory, AnimeSort>> = {
  trending: "trending",
  popular: "popularity",
  topRated: "score",
}

const tabs: ReadonlyArray<{
  value: AnimeDiscoveryCategory
  label: string
}> = [
  { value: "trending", label: tabLabels.trending },
  { value: "seasonal", label: tabLabels.seasonal },
  { value: "popular", label: tabLabels.popular },
  { value: "topRated", label: tabLabels.topRated },
  { value: "upcoming", label: tabLabels.upcoming },
]

export function DiscoverPage({ search }: { search: DiscoverSearch }) {
  return (
    <DiscoverLayout search={search}>
      <DiscoverResults search={search} />
    </DiscoverLayout>
  )
}

function DiscoverLayout({
  children,
  search,
}: {
  children: ReactNode
  search: DiscoverSearch
}) {
  const viewAllSort = catalogSort[search.tab]

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 pb-8 md:p-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="transition hover:text-foreground">
          Home
        </Link>
        <span>/</span>
        <span className="text-foreground">Discover</span>
      </nav>

      <PageHero
        icon={Sparkles}
        kicker="Discover"
        title={tabTitles[search.tab]}
        description={tabDescriptions[search.tab]}
      >
        {viewAllSort ? (
          <Link
            to="/series"
            search={{ sort: viewAllSort, page: 1 }}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Browse with filters
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </PageHero>

      <Tabs value={search.tab} className="max-w-full min-w-0">
        <TabsList className="no-scrollbar mb-5 h-auto max-w-full justify-start overflow-x-auto border bg-card p-1">
          {tabs.map(({ value, label }) => (
            <TabsTrigger key={value} value={value} asChild>
              <Link
                to="/discover"
                search={{ tab: value, page: 1 }}
                preload="intent"
                className="whitespace-nowrap"
              >
                {label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent key={search.tab} value={search.tab}>
          {children}
        </TabsContent>
      </Tabs>
    </div>
  )
}

const discoverPerPage = 24

function DiscoverResults({ search }: { search: DiscoverSearch }) {
  const atom = discoveryAtom(search.tab, search.page, discoverPerPage)
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)

  return Result.builder(result)
    .onInitialOrWaiting(() => <DiscoverResultsPending />)
    .onFailure(() => <DataError onRetry={refresh} />)
    .onSuccess((data) => (
      <div className="flex flex-col gap-6">
        <AnimeGrid
          items={data.items}
          emptyTitle="Nothing here yet"
          emptyDescription="This category has no titles right now. Try another tab."
        />
        {data.items.length > 0 ? (
          <DiscoverPagination hasNextPage={data.hasNextPage} search={search} />
        ) : null}
      </div>
    ))
    .render()
}

function DiscoverPagination({
  hasNextPage,
  search,
}: {
  hasNextPage: boolean
  search: DiscoverSearch
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      {search.page <= 1 ? (
        <Button variant="outline" disabled>
          <ChevronLeft className="size-4" />
          Previous
        </Button>
      ) : (
        <Button asChild variant="outline">
          <Link
            to="/discover"
            search={{ tab: search.tab, page: search.page - 1 }}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Link>
        </Button>
      )}
      <span className="text-sm text-muted-foreground">Page {search.page}</span>
      {!hasNextPage ? (
        <Button variant="outline" disabled>
          Next
          <ChevronRight className="size-4" />
        </Button>
      ) : (
        <Button asChild variant="outline">
          <Link
            to="/discover"
            search={{ tab: search.tab, page: search.page + 1 }}
          >
            Next
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      )}
    </div>
  )
}

function DiscoverResultsPending() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:gap-x-4 md:gap-y-6 lg:grid-cols-6">
        {Array.from({ length: discoverPerPage }, (_item, index) => (
          <div key={index} className="space-y-2.5">
            <Skeleton className="aspect-2/3 w-full rounded-2xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-full rounded-2xl" />
    </div>
  )
}
