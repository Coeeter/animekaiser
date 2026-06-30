import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import type { AnimeDiscoveryCategory, AnimePage } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import { PageHero } from "../../components/page-hero"
import { AnimeSection } from "./anime-section"
import { discoveryAtom } from "./atoms"
import type { DiscoverSearch } from "./search"

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

const moreHref: Partial<Record<AnimeDiscoveryCategory, string>> = {
  trending: "/series?sort=trending",
  popular: "/series?sort=popularity",
  topRated: "/series?sort=score",
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

export function DiscoverPage({
  search,
  initial,
}: {
  search: DiscoverSearch
  initial: AnimePage
}) {
  const result = useAtomValue(discoveryAtom(search.tab, search.page, 12))
  if (Result.isWaiting(result)) return <DiscoverPendingPage />

  const data = Result.match(result, {
    onInitial: () => initial,
    onFailure: () => initial,
    onSuccess: ({ value }) => value,
  })

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
        kicker={tabLabels[search.tab]}
        title="Discover anime"
        description="Browse trending shows, seasonal picks, top rated titles, and upcoming releases."
      />

      <Tabs value={search.tab} className="max-w-full min-w-0">
        <TabsList className="mb-4 h-auto max-w-full justify-start overflow-x-auto border bg-card p-1">
          {tabs.map(({ value, label }) => (
            <TabsTrigger key={value} value={value} asChild>
              <Link
                to="/discover"
                search={{ tab: value, page: 1 }}
                preload="intent"
              >
                {label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent key={search.tab} value={search.tab}>
          <AnimeSection
            title={tabTitles[search.tab]}
            description={tabDescriptions[search.tab]}
            items={data.items}
            moreHref={moreHref[search.tab]}
          />
        </TabsContent>
      </Tabs>

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
        <span className="text-sm text-muted-foreground">
          Page {search.page}
        </span>
        {!data.hasNextPage ? (
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
    </div>
  )
}

export function DiscoverPendingPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 pb-8 md:p-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_item, index) => (
          <div key={index} className="space-y-2.5">
            <Skeleton className="aspect-2/3 w-full rounded-xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
