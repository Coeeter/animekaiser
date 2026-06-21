import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link, createFileRoute } from "@tanstack/react-router"
import type { AnimeDiscoveryCategory } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Sparkles } from "lucide-react"
import { loadAnimeDiscovery } from "../api"
import { PageHero } from "../components/page-hero"
import { AnimeGrid } from "../features/anime/anime-grid"
import { discoveryAtom } from "../features/anime/atoms"

const tabs: ReadonlyArray<{ value: AnimeDiscoveryCategory; label: string }> = [
  { value: "trending", label: "Trending" },
  { value: "seasonal", label: "Seasonal" },
  { value: "popular", label: "Popular" },
  { value: "topRated", label: "Top Rated" },
  { value: "upcoming", label: "Upcoming" },
]

export const Route = createFileRoute("/discover")({
  validateSearch: (search): { tab: AnimeDiscoveryCategory; page: number } => ({
    tab:
      typeof search.tab === "string" &&
      tabs.some(({ value }) => value === search.tab)
        ? (search.tab as AnimeDiscoveryCategory)
        : "trending",
    page:
      typeof search.page === "number" && search.page > 0
        ? Math.floor(search.page)
        : 1,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadAnimeDiscovery(deps.tab, deps.page),
  component: DiscoverPage,
})

function DiscoverPage() {
  const search = Route.useSearch()
  const initial = Route.useLoaderData()
  const result = useAtomValue(
    discoveryAtom({
      category: search.tab,
      page: search.page,
      perPage: 24,
      initialValue: initial,
    })
  )
  const data = Result.match(result, {
    onInitial: () => initial,
    onFailure: () => initial,
    onSuccess: ({ value }) => value,
  })
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 p-4 pb-10 md:p-6">
      <nav className="flex gap-2 text-sm text-muted-foreground">
        <Link to="/">Home</Link>
        <span>/</span>
        <span className="text-foreground">Discover</span>
      </nav>
      <PageHero
        icon={Sparkles}
        kicker={
          tabs.find(({ value }) => value === search.tab)?.label ?? "Discover"
        }
        title="Discover anime"
        description="Browse trending shows, seasonal picks, top rated titles, and upcoming releases."
      />
      <Tabs value={search.tab}>
        <TabsList className="mb-5 h-auto w-full justify-start overflow-x-auto border bg-card p-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} asChild>
              <Link to="/discover" search={{ tab: tab.value, page: 1 }}>
                {tab.label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={search.tab}>
          <AnimeGrid items={data.items} />
        </TabsContent>
      </Tabs>
      <div className="flex items-center justify-between">
        <Button asChild variant="outline" disabled={search.page <= 1}>
          <Link
            to="/discover"
            search={{ ...search, page: Math.max(1, search.page - 1) }}
          >
            Previous
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {search.page}
        </span>
        <Button asChild variant="outline" disabled={!data.hasNextPage}>
          <Link to="/discover" search={{ ...search, page: search.page + 1 }}>
            Next
          </Link>
        </Button>
      </div>
    </main>
  )
}
