import { Badge } from "@animekaiser/ui/components/badge"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@animekaiser/ui/components/command"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import {
  Result,
  useAtom,
  useAtomMount,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { useNavigate } from "@tanstack/react-router"
import {
  ArrowRight,
  Clock3,
  Search,
  SearchX,
  Star,
  TrendingUp,
  X,
} from "lucide-react"
import { useState } from "react"
import { useDebouncedText } from "../../../hooks/use-debounced-text"
import { catalogAtom } from "../catalog/atoms"
import { formatAnimeFormat, formatAnimeStatus } from "./format"
import {
  clearRecentSearchesAtom,
  recentSearchesAtom,
  rememberSearchAtom,
  searchOpenAtom,
  searchShortcutAtom,
} from "./search-atoms"
import { animeTitlePreferenceAtom, getAnimeTitle } from "./title"

const searchDebounceMs = 220
const minSearchLength = 2
const searchResultLimit = 8

const suggestedGenres = [
  "Action",
  "Romance",
  "Comedy",
  "Fantasy",
  "Slice of Life",
  "Thriller",
]

export function SearchDialog() {
  const [open, setOpen] = useAtom(searchOpenAtom)
  const [query, setQuery] = useState("")
  const navigate = useNavigate()
  const rememberSearch = useAtomSet(rememberSearchAtom)

  useAtomMount(searchShortcutAtom)

  const trimmedQuery = query.trim()
  const debouncedQuery = useDebouncedText(trimmedQuery, searchDebounceMs)
  const hasQuery = trimmedQuery.length >= minSearchLength

  const close = () => setOpen(false)

  const goToCatalog = (nextQuery: string) => {
    const value = nextQuery.trim()
    if (value.length === 0) return

    rememberSearch(value)
    close()
    void navigate({
      to: "/series",
      search: { q: value, page: 1, sort: "relevance" },
    })
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
      title="Search anime"
      description="Search the anime catalog."
      className="sm:max-w-2xl"
    >
      <Command shouldFilter={false} loop>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search anime by title…"
        />
        <CommandList>
          {hasQuery ? (
            <>
              <SearchResults
                query={debouncedQuery}
                stale={debouncedQuery !== trimmedQuery}
                onSelect={(title) => {
                  rememberSearch(title)
                  close()
                }}
              />
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="see-all-results"
                  className="gap-2.5"
                  onSelect={() => goToCatalog(trimmedQuery)}
                >
                  <ArrowRight />
                  <span>
                    See all results for{" "}
                    <span className="font-semibold">{trimmedQuery}</span>
                  </span>
                </CommandItem>
              </CommandGroup>
            </>
          ) : (
            <SearchIdleState
              onPick={(value) => {
                setQuery(value)
              }}
              onSubmit={goToCatalog}
            />
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

function SearchIdleState({
  onPick,
  onSubmit,
}: {
  onPick: (query: string) => void
  onSubmit: (query: string) => void
}) {
  const recents = useAtomValue(recentSearchesAtom)
  const clearRecents = useAtomSet(clearRecentSearchesAtom)

  return (
    <>
      {recents.length > 0 ? (
        <CommandGroup heading="Recent searches">
          {recents.map((recent) => (
            <CommandItem
              key={recent}
              value={`recent-${recent}`}
              className="gap-2.5"
              onSelect={() => onSubmit(recent)}
            >
              <Clock3 />
              <span className="truncate">{recent}</span>
            </CommandItem>
          ))}
          <CommandItem
            value="clear-recent-searches"
            className="gap-2.5 text-muted-foreground"
            onSelect={() => clearRecents()}
          >
            <X />
            <span>Clear recent searches</span>
          </CommandItem>
        </CommandGroup>
      ) : null}

      <CommandGroup heading="Browse by genre">
        {suggestedGenres.map((genre) => (
          <CommandItem
            key={genre}
            value={`genre-${genre}`}
            className="gap-2.5"
            onSelect={() => onPick(genre)}
          >
            <TrendingUp />
            <span>{genre}</span>
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  )
}

function SearchResults({
  query,
  stale,
  onSelect,
}: {
  query: string
  stale: boolean
  onSelect: (query: string) => void
}) {
  const navigate = useNavigate()
  const preference = useAtomValue(animeTitlePreferenceAtom)

  const result = useAtomValue(
    catalogAtom({ q: query, page: 1, sort: "relevance" }, searchResultLimit)
  )

  return Result.builder(result)
    .onInitialOrWaiting(() => <SearchResultsPending />)
    .onFailure(() => (
      <CommandEmpty className="py-10">
        Search failed. Check your connection and try again.
      </CommandEmpty>
    ))
    .onSuccess((page) =>
      page.items.length === 0 ? (
        <CommandEmpty className="flex flex-col items-center gap-2 py-10">
          <SearchX className="size-5 text-muted-foreground" />
          <span>
            No anime found for{" "}
            <span className="font-semibold text-foreground">{query}</span>
          </span>
        </CommandEmpty>
      ) : (
        <CommandGroup
          heading={stale ? "Searching…" : "Anime"}
          className={stale ? "opacity-60" : undefined}
        >
          {page.items.map((anime) => {
            const title = getAnimeTitle(anime.title, preference)
            const status = formatAnimeStatus(anime.status)

            return (
              <CommandItem
                key={anime.malId}
                value={`${anime.malId} ${title}`}
                className="gap-3 p-2"
                onSelect={() => {
                  onSelect(title)
                  void navigate({
                    to: "/series/$id",
                    params: { id: anime.malId },
                  })
                }}
              >
                {anime.coverImage ? (
                  <img
                    src={anime.coverImage}
                    alt=""
                    className="h-20 w-14 shrink-0 rounded-xl bg-muted object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Search className="size-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="line-clamp-2 text-sm leading-snug font-medium">
                    {title}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal text-muted-foreground">
                    {anime.averageScore ? (
                      <span className="inline-flex items-center gap-1 font-medium text-foreground">
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                        {(anime.averageScore / 10).toFixed(1)}
                      </span>
                    ) : null}
                    <span>{formatAnimeFormat(anime.format)}</span>
                    {anime.seasonYear ? <span>{anime.seasonYear}</span> : null}
                    {anime.episodes ? <span>{anime.episodes} eps</span> : null}
                  </span>
                  {status ? (
                    <span>
                      <Badge
                        variant={
                          anime.status === "RELEASING" ? "default" : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {status}
                      </Badge>
                    </span>
                  ) : null}
                </div>
              </CommandItem>
            )
          })}
        </CommandGroup>
      )
    )
    .render()
}

function SearchResultsPending() {
  return (
    <div className="flex flex-col gap-1 p-1.5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 p-2">
          <Skeleton className="h-20 w-14 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}
