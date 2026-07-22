import { useForm } from "@tanstack/react-form"
import type {
  AnimeCatalogStatus,
  AnimeFormat,
  AnimeRating,
  AnimeSeason,
  AnimeSort,
} from "@workspace/domain"
import {
  AnimeCatalogStatus as AnimeCatalogStatusSchema,
  AnimeFormat as AnimeFormatSchema,
  AnimeRating as AnimeRatingSchema,
  AnimeSort as AnimeSortSchema,
} from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import * as Schema from "effect/Schema"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"
import { useEffect, useId, useState } from "react"
import type { CatalogSearch } from "./search"

const decodeSort = Schema.decodeUnknownSync(AnimeSortSchema)
const decodeFormat = Schema.decodeUnknownSync(AnimeFormatSchema)
const decodeStatus = Schema.decodeUnknownSync(AnimeCatalogStatusSchema)
const decodeRating = Schema.decodeUnknownSync(AnimeRatingSchema)

const sortOptions: Array<{ value: AnimeSort; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "popularity", label: "Popular" },
  { value: "trending", label: "Trending" },
  { value: "score", label: "Score" },
  { value: "newest", label: "Newest" },
  { value: "title", label: "Title" },
  { value: "episodes", label: "Episodes" },
  { value: "favorites", label: "Favorites" },
]

const seasonOptions: Array<{ value: AnimeSeason; label: string }> = [
  { value: "WINTER", label: "Winter" },
  { value: "SPRING", label: "Spring" },
  { value: "SUMMER", label: "Summer" },
  { value: "FALL", label: "Fall" },
]

const formatOptions: Array<{ value: AnimeFormat; label: string }> = [
  { value: "TV", label: "TV" },
  { value: "MOVIE", label: "Movie" },
  { value: "OVA", label: "OVA" },
  { value: "ONA", label: "ONA" },
  { value: "SPECIAL", label: "Special" },
]

const statusOptions: Array<{ value: AnimeCatalogStatus; label: string }> = [
  { value: "airing", label: "Airing" },
  { value: "complete", label: "Complete" },
  { value: "upcoming", label: "Upcoming" },
]

const ratingOptions: Array<{ value: AnimeRating; label: string }> = [
  { value: "g", label: "G" },
  { value: "pg", label: "PG" },
  { value: "pg13", label: "PG-13" },
  { value: "r17", label: "R-17" },
  { value: "r", label: "R+" },
]

const genreOptions = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
]

const startYear = 1995
const endYear = new Date().getFullYear() + 1
const yearOptions = Array.from(
  { length: endYear - startYear + 1 },
  (_, index) => endYear - index
)

const currentSeasonValue: AnimeSeason = (() => {
  const month = new Date().getMonth() + 1
  if (month <= 3) return "WINTER"
  if (month <= 6) return "SPRING"
  if (month <= 9) return "SUMMER"
  return "FALL"
})()

const currentYearValue = new Date().getFullYear()
const seasonOrder: ReadonlyArray<AnimeSeason> = [
  "FALL",
  "SUMMER",
  "SPRING",
  "WINTER",
]

const seasonYearOptions = (() => {
  const items: Array<{
    season: AnimeSeason
    year: number
    label: string
    value: string
    isCurrent: boolean
  }> = []
  for (const year of yearOptions) {
    for (const season of seasonOrder) {
      const label =
        seasonOptions.find((option) => option.value === season)?.label ?? season
      items.push({
        season,
        year,
        label: `${label} ${year}`,
        value: `${season}-${year}`,
        isCurrent: season === currentSeasonValue && year === currentYearValue,
      })
    }
  }
  return items
})()

const comboboxTriggerClass =
  "flex w-full cursor-default items-center justify-between gap-1.5 rounded-3xl border border-transparent bg-input/50 px-3 text-sm h-9 whitespace-nowrap transition-[color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"

const activeFilterKeys = [
  "q",
  "format",
  "status",
  "seasonYear",
  "rating",
  "genre",
] as const satisfies ReadonlyArray<keyof CatalogSearch>

const filterLabel = (key: keyof CatalogSearch, search: CatalogSearch) => {
  const value = search[key]
  if (key === "q") return `"${value}"`
  if (key === "format")
    return (
      formatOptions.find((option) => option.value === value)?.label ??
      String(value)
    )
  if (key === "status")
    return (
      statusOptions.find((option) => option.value === value)?.label ??
      String(value)
    )
  if (key === "seasonYear") {
    const seasonLabel = search.season
      ? seasonOptions.find((season) => season.value === search.season)?.label
      : null
    return seasonLabel ? `${seasonLabel} ${search.seasonYear}` : String(value)
  }
  if (key === "rating")
    return (
      ratingOptions.find((option) => option.value === value)?.label ??
      String(value)
    )
  if (key === "genre") {
    const genres = String(value).split(",")
    return genres.length > 2 ? `${genres.length} genres` : genres.join(", ")
  }
  return String(value)
}

function SeasonYearCombobox({
  season,
  year,
  onChange,
  id,
}: {
  season: AnimeSeason | undefined
  year: number | undefined
  onChange: (season: AnimeSeason | undefined, year: number | undefined) => void
  id?: string
}) {
  const [open, setOpen] = useState(false)

  const currentValue = season && year ? `${season}-${year}` : null
  const displayLabel =
    season && year
      ? `${seasonOptions.find((item) => item.value === season)?.label} ${year}`
      : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={comboboxTriggerClass}
        >
          <span
            className={cn("truncate", !displayLabel && "text-muted-foreground")}
          >
            {displayLabel ?? "Any season"}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search season..." />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="any"
                data-checked={!currentValue}
                onSelect={() => {
                  onChange(undefined, undefined)
                  setOpen(false)
                }}
              >
                Any season
              </CommandItem>
              {seasonYearOptions.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.label}
                  data-checked={currentValue === item.value}
                  onSelect={() => {
                    onChange(item.season, item.year)
                    setOpen(false)
                  }}
                  className="flex items-center justify-between"
                >
                  <span>{item.label}</span>
                  {item.isCurrent ? (
                    <Badge
                      variant="secondary"
                      className="ml-auto text-[10px] leading-none"
                    >
                      Now
                    </Badge>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function GenreCombobox({
  value,
  onChange,
  id,
}: {
  value: string | undefined
  onChange: (value: string | undefined) => void
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? value.split(",") : []

  const toggle = (genre: string) => {
    const next = selected.includes(genre)
      ? selected.filter((item) => item !== genre)
      : [...selected, genre]
    onChange(next.length > 0 ? next.join(",") : undefined)
  }

  const displayLabel =
    selected.length === 0
      ? null
      : selected.length <= 2
        ? selected.join(", ")
        : `${selected.length} genres`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={comboboxTriggerClass}
        >
          <span
            className={cn("truncate", !displayLabel && "text-muted-foreground")}
          >
            {displayLabel ?? "Any genre"}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search genres..." />
          <CommandList>
            <CommandEmpty>No genre found.</CommandEmpty>
            <CommandGroup>
              {genreOptions.map((genre) => (
                <CommandItem
                  key={genre}
                  value={genre}
                  onSelect={() => toggle(genre)}
                >
                  <Check
                    className={cn(
                      "size-3.5 shrink-0",
                      selected.includes(genre) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {genre}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function SeriesCatalogFilters({
  search,
  updateSearch,
  mode = "desktop",
  className,
  showSearch = true,
  showActions = true,
  showAdvanced = true,
}: {
  search: CatalogSearch
  updateSearch: (next: Partial<CatalogSearch>) => void
  mode?: "desktop" | "sheet"
  className?: string
  showSearch?: boolean
  showActions?: boolean
  showAdvanced?: boolean
}) {
  const searchId = useId()
  const form = useForm({
    defaultValues: { q: search.q ?? "" },
    onSubmit: ({ value }) => updateSearch({ q: value.q || undefined }),
  })
  useEffect(() => {
    form.reset({ q: search.q ?? "" })
  }, [search.q])

  const resetFilters = () => {
    form.reset({ q: "" })
    updateSearch({
      q: undefined,
      format: undefined,
      status: undefined,
      season: undefined,
      seasonYear: undefined,
      rating: undefined,
      genre: undefined,
    })
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      {showSearch ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_auto] xl:items-end">
          <form.Field name="q">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={searchId}>Search title</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    id={searchId}
                    name={field.name}
                    placeholder="Search by title, alternate name, or franchise"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  {field.state.value ? (
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        aria-label="Clear search"
                        onClick={() => {
                          field.handleChange("")
                          updateSearch({ q: undefined })
                        }}
                      >
                        <X />
                      </InputGroupButton>
                    </InputGroupAddon>
                  ) : null}
                </InputGroup>
              </Field>
            )}
          </form.Field>

          {showActions ? (
            <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
              <Button type="submit">
                <Search data-icon="inline-start" />
                Apply search
              </Button>
              <Button type="button" variant="ghost" onClick={resetFilters}>
                Reset filters
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showAdvanced ? (
        <FieldGroup className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Field>
            <FieldLabel htmlFor={`${mode}-series-sort`}>Sort</FieldLabel>
            <Select
              value={search.sort}
              onValueChange={(value) =>
                updateSearch({ sort: decodeSort(value) })
              }
            >
              <SelectTrigger id={`${mode}-series-sort`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field className="col-span-2 lg:col-span-1">
            <FieldLabel htmlFor={`${mode}-series-season-year`}>
              Season & Year
            </FieldLabel>
            <SeasonYearCombobox
              id={`${mode}-series-season-year`}
              season={search.season}
              year={search.seasonYear}
              onChange={(season, year) =>
                updateSearch({ season, seasonYear: year })
              }
            />
          </Field>

          <Field>
            <FieldLabel htmlFor={`${mode}-series-format`}>Format</FieldLabel>
            <Select
              value={search.format ?? "all"}
              onValueChange={(value) =>
                updateSearch({
                  format: value === "all" ? undefined : decodeFormat(value),
                })
              }
            >
              <SelectTrigger id={`${mode}-series-format`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Any format</SelectItem>
                  {formatOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor={`${mode}-series-status`}>Status</FieldLabel>
            <Select
              value={search.status ?? "all"}
              onValueChange={(value) =>
                updateSearch({
                  status: value === "all" ? undefined : decodeStatus(value),
                })
              }
            >
              <SelectTrigger id={`${mode}-series-status`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Any status</SelectItem>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor={`${mode}-series-rating`}>Rating</FieldLabel>
            <Select
              value={search.rating ?? "all"}
              onValueChange={(value) =>
                updateSearch({
                  rating: value === "all" ? undefined : decodeRating(value),
                })
              }
            >
              <SelectTrigger id={`${mode}-series-rating`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Any rating</SelectItem>
                  {ratingOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field className="col-span-2 lg:col-span-1">
            <FieldLabel htmlFor={`${mode}-series-genre`}>Genre</FieldLabel>
            <GenreCombobox
              id={`${mode}-series-genre`}
              value={search.genre}
              onChange={(genre) => updateSearch({ genre })}
            />
          </Field>
        </FieldGroup>
      ) : null}
    </form>
  )
}

function FilterPill({
  label,
  onClear,
}: {
  label: string
  onClear: () => void
}) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1.5">
      {label}
      <button
        type="button"
        aria-label={`Clear ${label}`}
        className="rounded-full p-0.5 transition hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={onClear}
      >
        <X className="size-3" />
      </button>
    </Badge>
  )
}

export function SeriesCatalogActiveFilters({
  search,
  clearFilter,
  removeGenre,
}: {
  search: CatalogSearch
  clearFilter: (key: keyof CatalogSearch) => void
  removeGenre: (genre: string) => void
}) {
  const activeFilters = getActiveFilters(search)

  if (activeFilters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {activeFilters.map((key) => {
        if (key === "genre") {
          const genres = String(search.genre).split(",")
          return genres.map((genre) => (
            <FilterPill
              key={`genre-${genre}`}
              label={genre}
              onClear={() => removeGenre(genre)}
            />
          ))
        }
        return (
          <FilterPill
            key={key}
            label={filterLabel(key, search)}
            onClear={() => clearFilter(key)}
          />
        )
      })}
    </div>
  )
}

export const getActiveFilters = (search: CatalogSearch) =>
  activeFilterKeys.filter((key) => {
    if (key === "seasonYear")
      return search.season !== undefined || search.seasonYear !== undefined
    return search[key] !== undefined && search[key] !== ""
  })

export const getSortLabel = (sort: AnimeSort) =>
  sortOptions.find((option) => option.value === sort)?.label ?? "Popular"
