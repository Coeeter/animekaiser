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
import { cn } from "@animekaiser/ui/lib/utils"
import {
  Result,
  useAtom,
  useAtomMount,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { useNavigate } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  Clock3,
  EyeOff,
  Languages,
  MoonStar,
  Search,
  SearchX,
  Settings,
  Star,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useState } from "react"
import { useDebouncedText } from "../../../hooks/use-debounced-text"
import { sessionAtom } from "../../auth/atoms"
import { mainLinks, personalLinks } from "../../layout/nav-links"
import { settingsOpenAtom, settingsSectionAtom } from "../../settings/atoms"
import {
  playerPreferencesAtom,
  updatePlayerPreferencesAtom,
} from "../../streaming/preferences"
import { catalogAtom } from "../catalog/atoms"
import { homeAtom } from "../home/atoms"
import { formatAnimeFormat, formatAnimeStatus } from "./format"
import {
  clearRecentSearchesAtom,
  recentSearchesAtom,
  rememberSearchAtom,
  searchOpenAtom,
  searchShortcutAtom,
  suggestedGenres,
} from "./search-atoms"
import {
  animeTitlePreferenceAtom,
  getAnimeTitle,
  setAnimeTitlePreferenceAtom,
} from "./title"

const searchDebounceMs = 220
const minSearchLength = 2
const searchResultLimit = 8

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
            <SearchIdleState onSubmit={goToCatalog} onDone={close} />
          )}
          {trimmedQuery.length > 0 ? (
            <PaletteCommands query={trimmedQuery} onDone={close} />
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

type PaletteAction = {
  id: string
  title: string
  keywords: string
  icon: LucideIcon
  run: () => void
}

function PaletteCommands({
  query,
  onDone,
}: {
  query: string
  onDone: () => void
}) {
  const navigate = useNavigate()
  const signedIn = Result.builder(useAtomValue(sessionAtom))
    .onSuccess((session) => session !== null)
    .orElse(() => false)
  const [titlePreference, setTitlePreference] = useAtom(
    setAnimeTitlePreferenceAtom
  )
  const { blurUnwatched } = useAtomValue(playerPreferencesAtom)
  const updatePlayerPreferences = useAtomSet(updatePlayerPreferencesAtom)
  const setSettingsSection = useAtomSet(settingsSectionAtom)
  const setSettingsOpen = useAtomSet(settingsOpenAtom)
  const { resolvedTheme, setTheme } = useTheme()

  const needle = query.toLowerCase()
  const matches = (text: string) => text.toLowerCase().includes(needle)

  const pages = [...mainLinks, ...(signedIn ? personalLinks : [])].filter(
    (link) => matches(link.title)
  )

  const actions: ReadonlyArray<PaletteAction> = [
    {
      id: "title-language",
      title:
        titlePreference === "english"
          ? "Show romaji titles"
          : "Show English titles",
      keywords: "title language english romaji japanese",
      icon: Languages,
      run: () =>
        setTitlePreference(
          titlePreference === "english" ? "romaji" : "english"
        ),
    },
    {
      id: "theme",
      title:
        resolvedTheme === "dark"
          ? "Switch to light theme"
          : "Switch to dark theme",
      keywords: "theme dark light mode",
      icon: MoonStar,
      run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    },
    {
      id: "spoilers",
      title: blurUnwatched ? "Show episode spoilers" : "Hide episode spoilers",
      keywords: "spoiler blur thumbnails synopsis",
      icon: EyeOff,
      run: () => updatePlayerPreferences({ blurUnwatched: !blurUnwatched }),
    },
    {
      id: "settings",
      title: "Open settings",
      keywords: "settings preferences playback account",
      icon: Settings,
      run: () => {
        setSettingsSection("Account")
        setSettingsOpen(true)
      },
    },
  ].filter((action) => matches(`${action.title} ${action.keywords}`))

  return (
    <>
      {pages.length > 0 ? (
        <CommandGroup heading="Pages">
          {pages.map((link) => (
            <CommandItem
              key={link.href}
              value={`page-${link.href}`}
              className="gap-2.5"
              onSelect={() => {
                onDone()
                void navigate({ to: link.href })
              }}
            >
              <link.icon />
              <span>{link.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}
      {actions.length > 0 ? (
        <CommandGroup heading="Shortcuts">
          {actions.map((action) => (
            <CommandItem
              key={action.id}
              value={`action-${action.id}`}
              className="gap-2.5"
              onSelect={() => {
                onDone()
                action.run()
              }}
            >
              <action.icon />
              <span>{action.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}
    </>
  )
}

const chipItem =
  "h-8 w-auto shrink-0 rounded-full border px-3 py-0 text-xs data-[selected=true]:border-primary/60"
const chipGroup =
  "[&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:flex-wrap [&_[cmdk-group-items]]:gap-2"

function SearchIdleState({
  onSubmit,
  onDone,
}: {
  onSubmit: (query: string) => void
  onDone: () => void
}) {
  const navigate = useNavigate()
  const recents = useAtomValue(recentSearchesAtom)
  const clearRecents = useAtomSet(clearRecentSearchesAtom)
  const preference = useAtomValue(animeTitlePreferenceAtom)
  const trending = Result.builder(useAtomValue(homeAtom))
    .onSuccess((home) => home.trending.slice(0, 6))
    .orElse(() => [])

  return (
    <>
      {recents.length > 0 ? (
        <CommandGroup heading="Recent searches" className={chipGroup}>
          {recents.map((recent) => (
            <CommandItem
              key={recent}
              value={`recent-${recent}`}
              className={chipItem}
              onSelect={() => onSubmit(recent)}
            >
              <Clock3 />
              <span className="max-w-40 truncate">{recent}</span>
            </CommandItem>
          ))}
          <CommandItem
            value="clear-recent-searches"
            className={cn(chipItem, "border-dashed text-muted-foreground")}
            onSelect={() => clearRecents()}
          >
            <X />
            Clear
          </CommandItem>
        </CommandGroup>
      ) : null}

      {trending.length > 0 ? (
        <CommandGroup
          heading="Trending now"
          className="[&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:grid-cols-3 [&_[cmdk-group-items]]:gap-2 sm:[&_[cmdk-group-items]]:grid-cols-6"
        >
          {trending.map((anime) => {
            const title = getAnimeTitle(anime.title, preference)
            return (
              <CommandItem
                key={anime.malId}
                value={`trending-${anime.malId}`}
                className="flex-col items-stretch gap-1.5 p-1.5"
                onSelect={() => {
                  onDone()
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
                    className="aspect-2/3 w-full rounded-lg bg-muted object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="aspect-2/3 w-full rounded-lg bg-muted" />
                )}
                <span className="line-clamp-2 text-xs leading-snug font-medium">
                  {title}
                </span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      ) : null}

      <CommandGroup heading="Browse by genre" className={chipGroup}>
        {suggestedGenres.map((genre) => (
          <CommandItem
            key={genre}
            value={`genre-${genre}`}
            className={chipItem}
            onSelect={() => {
              onDone()
              void navigate({
                to: "/series",
                search: { genre, page: 1, sort: "popularity" },
              })
            }}
          >
            {genre}
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
