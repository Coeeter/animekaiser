import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import type {
  AnimeFormat,
  AnimePage,
  AnimeRating,
  AnimeSeason,
  AnimeSort,
} from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Compass, Search } from "lucide-react"
import { PageHero } from "../../components/page-hero"
import { AnimeGrid } from "./anime-grid"
import { catalogAtom } from "./atoms"
import { catalogInput } from "./search"
import type { CatalogSearch } from "./search"

const sorts: ReadonlyArray<AnimeSort> = [
  "popularity",
  "score",
  "trending",
  "newest",
  "title",
  "episodes",
]
const formats: ReadonlyArray<AnimeFormat> = [
  "TV",
  "MOVIE",
  "OVA",
  "ONA",
  "SPECIAL",
  "MUSIC",
  "TV_SHORT",
]
const seasons: ReadonlyArray<AnimeSeason> = [
  "WINTER",
  "SPRING",
  "SUMMER",
  "FALL",
]
const ratings: ReadonlyArray<AnimeRating> = ["g", "pg", "pg13", "r17", "r"]

export function CatalogPage({
  search,
  initial,
}: {
  search: CatalogSearch
  initial: AnimePage
}) {
  const input = catalogInput(search)
  const result = useAtomValue(catalogAtom({ input, initialValue: initial }))
  const page = Result.match(result, {
    onInitial: () => initial,
    onFailure: () => initial,
    onSuccess: ({ value }) => value,
  })

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 p-4 pb-10 md:p-6">
      <nav className="flex gap-2 text-sm text-muted-foreground">
        <Link to="/">Home</Link>
        <span>/</span>
        <span className="text-foreground">Browse</span>
      </nav>
      <PageHero
        icon={Compass}
        kicker={`${page.items.length} titles on this page`}
        title="Browse anime"
        description="Search and filter the catalog to find your next series."
      />
      <form
        className="grid gap-3 rounded-2xl border bg-card/70 p-4 sm:grid-cols-2 xl:grid-cols-4"
        action="/series"
      >
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={search.q}
            className="pl-9"
            placeholder="Search titles…"
          />
        </div>
        <select
          name="sort"
          defaultValue={search.sort}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          {sorts.map((sort) => (
            <option key={sort} value={sort}>
              {sort}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={search.status ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="airing">Airing</option>
          <option value="complete">Complete</option>
          <option value="upcoming">Upcoming</option>
        </select>
        <select
          name="format"
          defaultValue={search.format ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All formats</option>
          {formats.map((format) => (
            <option key={format} value={format}>
              {format}
            </option>
          ))}
        </select>
        <Input
          name="genres"
          defaultValue={search.genres}
          placeholder="Genres (comma separated)"
        />
        <select
          name="season"
          defaultValue={search.season ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All seasons</option>
          {seasons.map((season) => (
            <option key={season} value={season}>
              {season}
            </option>
          ))}
        </select>
        <Input
          name="seasonYear"
          type="number"
          min={1900}
          max={2200}
          defaultValue={search.seasonYear}
          placeholder="Season year"
        />
        <select
          name="rating"
          defaultValue={search.rating ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All ratings</option>
          {ratings.map((rating) => (
            <option key={rating} value={rating}>
              {rating.toUpperCase()}
            </option>
          ))}
        </select>
        <Input
          name="minScore"
          type="number"
          min={0}
          max={10}
          step={0.1}
          defaultValue={search.minScore}
          placeholder="Minimum score"
        />
        <Input
          name="maxScore"
          type="number"
          min={0}
          max={10}
          step={0.1}
          defaultValue={search.maxScore}
          placeholder="Maximum score"
        />
        <div className="flex gap-2 sm:col-span-2 xl:col-span-4 xl:justify-end">
          <Button asChild type="button" variant="ghost">
            <Link to="/series" search={{ page: 1, sort: "popularity" }}>
              Reset
            </Link>
          </Button>
          <Button type="submit">Apply filters</Button>
        </div>
      </form>
      <AnimeGrid items={page.items} />
      <div className="flex items-center justify-between">
        <Button asChild variant="outline" disabled={search.page <= 1}>
          <Link
            to="/series"
            search={{ ...search, page: Math.max(1, search.page - 1) }}
          >
            Previous
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {search.page}
        </span>
        <Button asChild variant="outline" disabled={!page.hasNextPage}>
          <Link to="/series" search={{ ...search, page: search.page + 1 }}>
            Next
          </Link>
        </Button>
      </div>
    </main>
  )
}
