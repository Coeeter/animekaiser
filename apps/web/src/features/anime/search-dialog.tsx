import { Result, useAtomValue } from "@effect-atom/atom-react"
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
import { useDebouncedText } from "../../lib/use-debounced-text"
import { catalogAtom } from "./atoms"
import { formatAnimeFormat } from "./format"
import { animeTitlePreferenceAtom, getAnimeTitle } from "./title"

const searchDebounceMs = 1000
const minSearchLength = 2
const searchResultLimit = 8

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = useState("")
  const trimmedQuery = query.trim()
  const debouncedQuery = useDebouncedText(trimmedQuery, searchDebounceMs)

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
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
        <CommandList className="max-h-[28rem]">
          {trimmedQuery.length < minSearchLength ? (
            <CommandEmpty>Type at least 2 characters.</CommandEmpty>
          ) : debouncedQuery !== trimmedQuery ? (
            <CommandEmpty>Searching...</CommandEmpty>
          ) : (
            <SearchResults query={debouncedQuery} onOpenChange={onOpenChange} />
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

function SearchResults({
  query,
  onOpenChange,
}: {
  query: string
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const preference = useAtomValue(animeTitlePreferenceAtom)
  const result = useAtomValue(
    catalogAtom(query, 1, searchResultLimit, "relevance")
  )

  return Result.match(result, {
    onInitial: () => <CommandEmpty>Searching...</CommandEmpty>,
    onFailure: () => <CommandEmpty>Search failed. Try again.</CommandEmpty>,
    onSuccess: ({ value: page }) =>
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
                  onOpenChange(false)
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
      ),
  })
}
