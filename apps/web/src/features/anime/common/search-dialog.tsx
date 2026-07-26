import {
  Result,
  useAtom,
  useAtomMount,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { useNavigate } from "@tanstack/react-router"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import { Search } from "lucide-react"
import { useState } from "react"
import { useDebouncedText } from "../../../hooks/use-debounced-text"
import { catalogAtom } from "../catalog/atoms"
import { formatAnimeFormat } from "./format"
import { searchOpenAtom, searchShortcutAtom } from "./search-atoms"
import { animeTitlePreferenceAtom, getAnimeTitle } from "./title"

const searchDebounceMs = 1000
const minSearchLength = 2
const searchResultLimit = 8

export function SearchDialog() {
  const [open, setOpen] = useAtom(searchOpenAtom)
  const [query, setQuery] = useState("")

  useAtomMount(searchShortcutAtom)

  const trimmedQuery = query.trim()
  const debouncedQuery = useDebouncedText(trimmedQuery, searchDebounceMs)

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search anime"
      description="Search the anime catalog."
      className="sm:max-w-2xl"
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search anime..."
        />
        <CommandList className="max-h-112">
          {trimmedQuery.length < minSearchLength ? (
            <CommandEmpty>Type at least 2 characters.</CommandEmpty>
          ) : debouncedQuery !== trimmedQuery ? (
            <CommandEmpty>Searching...</CommandEmpty>
          ) : (
            <SearchResults query={debouncedQuery} />
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

function SearchResults({ query }: { query: string }) {
  const navigate = useNavigate()
  const setOpen = useAtomSet(searchOpenAtom)
  const preference = useAtomValue(animeTitlePreferenceAtom)

  const result = useAtomValue(
    catalogAtom({ q: query, page: 1, sort: "relevance" }, searchResultLimit)
  )

  return Result.builder(result)
    .onInitialOrWaiting(() => <CommandEmpty>Searching...</CommandEmpty>)
    .onFailure(() => <CommandEmpty>Search failed. Try again.</CommandEmpty>)
    .onSuccess((page) =>
      page.items.length === 0 ? (
        <CommandEmpty>No anime found.</CommandEmpty>
      ) : (
        <CommandGroup heading="Anime">
          {page.items.map((anime) => {
            const title = getAnimeTitle(anime.title, preference)
            const subtitle =
              [
                formatAnimeFormat(anime.format),
                anime.seasonYear,
                anime.averageScore ? `${anime.averageScore}%` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Anime"

            return (
              <CommandItem
                key={anime.malId}
                value={`${anime.malId} ${title}`}
                className="gap-3 px-2 py-2"
                onSelect={() => {
                  setOpen(false)
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
                    className="h-24 w-16 shrink-0 rounded-xl bg-muted object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Search className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="line-clamp-2 text-base leading-snug">
                    {title}
                  </span>
                  <span className="truncate text-sm font-normal text-muted-foreground">
                    {subtitle}
                  </span>
                </div>
              </CommandItem>
            )
          })}
        </CommandGroup>
      )
    )
    .render()
}
