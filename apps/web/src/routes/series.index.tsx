import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link, createFileRoute } from "@tanstack/react-router"
import type {
  AnimeFormat,
  AnimeRating,
  AnimeSeason,
  AnimeSort,
} from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Compass, Search } from "lucide-react"
import { loadAnimeCatalog } from "../api"
import { PageHero } from "../components/page-hero"
import { AnimeGrid } from "../features/anime/anime-grid"
import { catalogAtom } from "../features/anime/atoms"

type CatalogSearch = {
  q?: string
  page: number
  sort: AnimeSort
  status?: "airing" | "complete" | "upcoming"
  format?: AnimeFormat
  genres?: ReadonlyArray<string>
  season?: AnimeSeason
  seasonYear?: number
  rating?: AnimeRating
  minScore?: number
  maxScore?: number
}

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

export const Route = createFileRoute("/series/")({
  validateSearch: (search): CatalogSearch => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q : undefined,
    page:
      typeof search.page === "number" && search.page > 0
        ? Math.floor(search.page)
        : 1,
    sort:
      typeof search.sort === "string" &&
      sorts.includes(search.sort as AnimeSort)
        ? (search.sort as AnimeSort)
        : "popularity",
    status:
      search.status === "airing" ||
      search.status === "complete" ||
      search.status === "upcoming"
        ? search.status
        : undefined,
    format:
      typeof search.format === "string" &&
      formats.includes(search.format as AnimeFormat)
        ? (search.format as AnimeFormat)
        : undefined,
    genres:
      typeof search.genres === "string" && search.genres.trim()
        ? search.genres
            .split(",")
            .map((genre) => genre.trim())
            .filter(Boolean)
        : undefined,
    season:
      typeof search.season === "string" &&
      seasons.includes(search.season as AnimeSeason)
        ? (search.season as AnimeSeason)
        : undefined,
    seasonYear:
      typeof search.seasonYear === "number" &&
      search.seasonYear >= 1900 &&
      search.seasonYear <= 2200
        ? Math.floor(search.seasonYear)
        : undefined,
    rating:
      typeof search.rating === "string" &&
      ratings.includes(search.rating as AnimeRating)
        ? (search.rating as AnimeRating)
        : undefined,
    minScore:
      typeof search.minScore === "number" &&
      search.minScore >= 0 &&
      search.minScore <= 10
        ? search.minScore
        : undefined,
    maxScore:
      typeof search.maxScore === "number" &&
      search.maxScore >= 0 &&
      search.maxScore <= 10
        ? search.maxScore
        : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    loadAnimeCatalog({
      query: deps.q,
      page: deps.page,
      perPage: 30,
      sort: deps.sort,
      status: deps.status,
      format: deps.format,
      genres: deps.genres,
      season: deps.season,
      seasonYear: deps.seasonYear,
      rating: deps.rating,
      minScore: deps.minScore,
      maxScore: deps.maxScore,
    }),
  component: CatalogPage,
})

function CatalogPage() {
  const search = Route.useSearch()
  const initial = Route.useLoaderData()
  const input = {
    query: search.q,
    page: search.page,
    perPage: 30,
    sort: search.sort,
    status: search.status,
    format: search.format,
    genres: search.genres,
    season: search.season,
    seasonYear: search.seasonYear,
    rating: search.rating,
    minScore: search.minScore,
    maxScore: search.maxScore,
  }
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
          defaultValue={search.genres?.join(", ")}
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
