import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Link, useNavigate } from "@tanstack/react-router"
import { ArrowRight, Clock3, SearchX } from "lucide-react"
import { DebouncedSearchInput } from "../../../components/debounced-search-input"
import { catalogAtom } from "../catalog/atoms"
import { AnimeCard } from "../common/anime-card"
import {
  clearRecentSearchesAtom,
  recentSearchesAtom,
  rememberSearchAtom,
  suggestedGenres,
} from "../common/search-atoms"
import { homeAtom } from "../home/atoms"

const minSearchLength = 2
const resultLimit = 24

const chip =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition hover:border-primary/60 hover:text-foreground"

export function SearchPage({ query }: { query: string }) {
  const navigate = useNavigate()
  const trimmed = query.trim()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      <div className="sticky top-14 z-30 -mb-2 bg-background/85 px-4 pt-3 pb-3 backdrop-blur-xl md:top-0 md:px-6 md:pt-6">
        <DebouncedSearchInput
          committed={trimmed}
          onCommit={(next) =>
            void navigate({
              to: "/search",
              search: next ? { q: next } : {},
              replace: true,
            })
          }
          placeholder="Search anime"
          label="Search anime"
          className="h-12 rounded-2xl text-base"
          autoFocus
        />
      </div>

      <div className="px-4 md:px-6">
        {trimmed.length >= minSearchLength ? (
          <SearchResults query={trimmed} />
        ) : (
          <SearchSuggestions />
        )}
      </div>
    </div>
  )
}

function SearchSuggestions() {
  const recents = useAtomValue(recentSearchesAtom)
  const clearRecents = useAtomSet(clearRecentSearchesAtom)
  const trending = Result.builder(useAtomValue(homeAtom))
    .onSuccess((home) => home.trending.slice(0, 9))
    .orElse(() => [])

  return (
    <div className="flex flex-col gap-8">
      {recents.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-bold">
              Recent searches
            </h2>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => clearRecents()}
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recents.map((recent) => (
              <Link
                key={recent}
                to="/search"
                search={{ q: recent }}
                replace
                className={chip}
              >
                <Clock3 className="size-3.5 text-muted-foreground" />
                <span className="max-w-48 truncate">{recent}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-bold">Browse by genre</h2>
        <div className="flex flex-wrap gap-2">
          {suggestedGenres.map((genre) => (
            <Link
              key={genre}
              to="/series"
              search={{ genre, page: 1, sort: "popularity" }}
              className={chip}
            >
              {genre}
            </Link>
          ))}
        </div>
      </section>

      {trending.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-base font-bold">Trending now</h2>
          <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
            {trending.map((anime) => (
              <AnimeCard key={anime.malId} anime={anime} compact />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function SearchResults({ query }: { query: string }) {
  const rememberSearch = useAtomSet(rememberSearchAtom)
  const result = useAtomValue(
    catalogAtom({ q: query, page: 1, sort: "relevance" }, resultLimit)
  )

  return Result.builder(result)
    .onInitialOrWaiting(() => (
      <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_item, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="aspect-2/3 w-full rounded-2xl" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    ))
    .onFailure(() => (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Search failed. Check your connection and try again.
      </p>
    ))
    .onSuccess((page) =>
      page.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
          <SearchX className="size-6" />
          No anime found for{" "}
          <span className="font-semibold text-foreground">{query}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div
            className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6"
            onClickCapture={() => rememberSearch(query)}
          >
            {page.items.map((anime) => (
              <AnimeCard key={anime.malId} anime={anime} compact />
            ))}
          </div>
          <Link
            to="/series"
            search={{ q: query, page: 1, sort: "relevance" }}
            onClick={() => rememberSearch(query)}
            className="inline-flex items-center justify-center gap-1.5 self-center rounded-full border px-4 py-2 text-sm font-medium transition hover:border-primary/60"
          >
            More results and filters
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )
    )
    .render()
}
