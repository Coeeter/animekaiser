import { Result, useAtom, useAtomValue } from "@effect-atom/atom-react"
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
import { useDeferredValue, useMemo, useState } from "react"
import { catalogAtom } from "./atoms"
import { animeTitlePreferenceAtom, getAnimeTitle } from "./title"

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim())
  const searchAtom = useMemo(
    () =>
      catalogAtom({
        input: {
          query: deferredQuery || undefined,
          page: 1,
          perPage: 10,
          sort: "relevance",
        },
      }),
    [deferredQuery]
  )
  const result = useAtomValue(searchAtom)
  const [preference] = useAtom(animeTitlePreferenceAtom)

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search anime"
      description="Search the anime catalog."
    >
      <Command>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search anime…"
        />
        <CommandList>
          {!deferredQuery ? (
            <CommandEmpty>Start typing to search anime.</CommandEmpty>
          ) : (
            Result.match(result, {
              onInitial: () => <CommandEmpty>Searching…</CommandEmpty>,
              onFailure: () => (
                <CommandEmpty>Search is unavailable.</CommandEmpty>
              ),
              onSuccess: ({ value: page }) =>
                page.items.length === 0 ? (
                  <CommandEmpty>No anime found.</CommandEmpty>
                ) : (
                  <CommandGroup heading="Anime">
                    {page.items.map((anime) => (
                      <CommandItem
                        key={anime.malId}
                        value={`${anime.malId}-${anime.title.romaji}`}
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
                            className="aspect-2/3 w-8 rounded object-cover"
                          />
                        ) : (
                          <div className="aspect-2/3 w-8 rounded bg-muted" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate">
                            {getAnimeTitle(anime.title, preference)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            MAL {anime.malId}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ),
            })
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
