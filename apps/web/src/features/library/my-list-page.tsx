import type {
  ExternalListProvider,
  LibraryPage,
  LibraryStats,
  LibraryStatus,
} from "@animekaiser/domain"
import { LibrarySort } from "@animekaiser/domain"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@animekaiser/ui/components/alert-dialog"
import { Button } from "@animekaiser/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@animekaiser/ui/components/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@animekaiser/ui/components/empty"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@animekaiser/ui/components/select"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@animekaiser/ui/components/tabs"
import { cn } from "@animekaiser/ui/lib/utils"
import {
  Result,
  useAtom,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link, useNavigate } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import {
  ArrowDownWideNarrow,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ListRestart,
  ListVideo,
  MoreHorizontal,
  Play,
  SearchX,
  Star,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { DataError } from "../../components/data-error"
import { DebouncedSearchInput } from "../../components/debounced-search-input"
import { PageHero } from "../../components/page-hero"
import { StatTile } from "../../components/stat-tile"
import { isStaleResult, useLastSuccess } from "../../hooks/use-last-success"
import {
  clearLibraryAtom,
  libraryPageAtom,
  libraryReactivityKeys,
  startLibraryImportAtom,
  watchLibraryImportAtom,
} from "./atoms"
import { librarySorts, libraryStatuses } from "./constants"
import { LibraryCard } from "./library-entry-components"
import type { MyListSearch } from "./search"

const decodeLibrarySort = Schema.decodeUnknownSync(LibrarySort)

const sortLabels: Record<LibrarySort, string> = {
  updated_desc: "Recently updated",
  updated_asc: "Oldest updated",
  title_asc: "Title A-Z",
  score_desc: "Highest score",
  progress_desc: "Most progress",
}

const formatMeanScore = (score: number | null) => {
  if (score === null) return null
  const value = score / 10
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

const statusCount = (stats: LibraryStats, value: "all" | LibraryStatus) =>
  value === "all" ? stats.total : stats.byStatus[value]

export function MyListPage({ search }: { search: MyListSearch }) {
  const queryAtom = libraryPageAtom(
    search.status === "all" ? undefined : search.status,
    search.sort,
    search.page,
    30,
    search.q?.trim() || undefined
  )
  const result = useAtomValue(queryAtom)
  const refresh = useAtomRefresh(queryAtom)
  const page = useLastSuccess(result)
  const stale = isStaleResult(result, page)

  const failure = Result.builder(result)
    .onFailure(() => <DataError onRetry={refresh} />)
    .orNull()

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 pb-8 md:p-6">
      <PageHero
        icon={Bookmark}
        kicker="Your library"
        title="My list"
        description="Track your anime library, scores, and watch progress."
      >
        <MyListActions
          refresh={refresh}
          hasEntries={(page?.stats.total ?? 0) > 0}
        />
      </PageHero>

      {failure ??
        (page ? (
          <MyListContent
            page={page}
            search={search}
            refresh={refresh}
            stale={stale}
          />
        ) : (
          <MyListPending />
        ))}
    </div>
  )
}

function MyListContent({
  page,
  search,
  refresh,
  stale,
}: {
  page: LibraryPage
  search: MyListSearch
  refresh: () => void
  stale: boolean
}) {
  const status = search.status === "all" ? null : search.status
  const currentPage = Math.min(search.page, page.totalPages)

  return (
    <>
      <LibraryStatTiles stats={page.stats} />

      <MyListToolbar search={search} status={status} stats={page.stats} />

      <section
        className={cn(
          "flex flex-col gap-4 transition-opacity",
          stale && "opacity-60"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold tracking-tight">
            Results
          </h2>
          <span className="text-sm text-muted-foreground">
            Sorted by {sortLabels[search.sort].toLowerCase()}
          </span>
        </div>

        {page.items.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {page.items.map((entry) => (
              <LibraryCard
                key={entry.malId}
                entry={entry}
                onChanged={refresh}
              />
            ))}
          </div>
        ) : (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {search.q ? <SearchX /> : <Bookmark />}
              </EmptyMedia>
              <EmptyTitle>
                {search.q
                  ? `No titles match “${search.q}”`
                  : "Nothing here yet"}
              </EmptyTitle>
              <EmptyDescription>
                {search.q
                  ? "Try a different spelling, or clear the search to see your whole list."
                  : "Add a title from a series page, or import a linked provider list."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        <LibraryPagination
          page={currentPage}
          perPage={page.perPage}
          search={search}
          status={status}
          totalItems={page.total}
          totalPages={page.totalPages}
        />
      </section>
    </>
  )
}

function LibraryStatTiles({ stats }: { stats: LibraryStats }) {
  const meanScore = formatMeanScore(stats.meanScore)

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatTile
        icon={ListVideo}
        label="Titles"
        value={stats.total.toLocaleString()}
        hint={`${stats.byStatus.planning.toLocaleString()} planned`}
      />
      <StatTile
        icon={Play}
        label="Watching"
        value={stats.byStatus.watching.toLocaleString()}
        hint={`${stats.byStatus.rewatching.toLocaleString()} rewatching`}
      />
      <StatTile
        icon={CheckCircle2}
        label="Completed"
        value={stats.byStatus.completed.toLocaleString()}
        hint={`${stats.byStatus.dropped.toLocaleString()} dropped`}
      />
      <StatTile
        icon={Star}
        label="Mean score"
        value={meanScore ?? "—"}
        hint={meanScore ? "Across rated titles" : "Nothing rated yet"}
      />
    </div>
  )
}

function MyListToolbar({
  search,
  status,
  stats,
}: {
  search: MyListSearch
  status: LibraryStatus | null
  stats: LibraryStats
}) {
  const navigate = useNavigate()

  return (
    <section className="rounded-xl border bg-card/80">
      <div className="flex flex-col gap-4 p-4 md:p-5">
        <DebouncedSearchInput
          committed={search.q?.trim() ?? ""}
          placeholder="Search your list…"
          label="Search your list"
          onCommit={(q) =>
            void navigate({
              to: "/my-list",
              search: {
                status: search.status,
                sort: search.sort,
                q,
                page: 1,
              },
              replace: true,
            })
          }
        />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <LibraryStatusTabs search={search} value={status} stats={stats} />
          <LibrarySortSelect search={search} status={status} />
        </div>
      </div>
    </section>
  )
}

function MyListActions({
  refresh,
  hasEntries,
}: {
  refresh: () => void
  hasEntries: boolean
}) {
  const startLibraryImport = useAtomSet(startLibraryImportAtom, {
    mode: "promise",
  })
  const [pendingProvider, setPendingProvider] =
    useState<ExternalListProvider | null>(null)
  const [watchingJobId, setWatchingJobId] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)

  const start = async (provider: ExternalListProvider) => {
    setPendingProvider(provider)
    try {
      const job = await startLibraryImport({ payload: { provider } })
      toast.success(`Import queued: ${job.id}`)
      setWatchingJobId(job.id)
    } catch {
      toast.error("Connect this provider in Settings first")
    } finally {
      setPendingProvider(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {watchingJobId ? (
        <ImportWatcher
          id={watchingJobId}
          refresh={refresh}
          stop={() => setWatchingJobId(null)}
        />
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={pendingProvider !== null}>
            <Download data-icon="inline-start" />
            {pendingProvider === null ? "Import" : "Importing…"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Import from a linked account</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => void start("mal")}>
              MyAnimeList
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void start("anilist")}>
              AniList
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button asChild variant="outline">
        <Link to="/sync-activity" search={{ page: 1 }}>
          <ListRestart data-icon="inline-start" />
          Sync activity
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More list actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Danger zone</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={!hasEntries}
            onSelect={() => setClearOpen(true)}
          >
            <Trash2 data-icon="inline-start" />
            Clear my list
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ClearLibraryDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        refresh={refresh}
      />
    </div>
  )
}

function LibraryStatusTabs({
  search,
  value,
  stats,
}: {
  search: MyListSearch
  value: LibraryStatus | null
  stats: LibraryStats
}) {
  return (
    <Tabs value={value ?? "all"} className="max-w-full min-w-0">
      <TabsList className="no-scrollbar h-auto max-w-full justify-start overflow-x-auto border bg-card p-1">
        {libraryStatuses.map((status) => (
          <TabsTrigger key={status.value} value={status.value} asChild>
            <Link
              to="/my-list"
              search={{
                sort: search.sort,
                q: search.q,
                status: status.value,
                page: 1,
              }}
              className="gap-1.5 whitespace-nowrap"
            >
              {status.label}
              <span className="text-xs text-muted-foreground tabular-nums">
                {statusCount(stats, status.value).toLocaleString()}
              </span>
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

function LibrarySortSelect({
  search,
  status,
}: {
  search: MyListSearch
  status: LibraryStatus | null
}) {
  const navigate = useNavigate()
  return (
    <div className="flex shrink-0 items-center gap-2">
      <ArrowDownWideNarrow className="size-4 shrink-0 text-muted-foreground" />
      <Select
        value={search.sort}
        onValueChange={(value) =>
          void navigate({
            to: "/my-list",
            search: {
              status: status ?? "all",
              q: search.q,
              sort: decodeLibrarySort(value),
              page: 1,
            },
          })
        }
      >
        <SelectTrigger className="w-full lg:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {librarySorts.map((value) => (
              <SelectItem key={value} value={value}>
                {sortLabels[value]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function LibraryPagination({
  page,
  perPage,
  search: currentSearch,
  status,
  totalItems,
  totalPages,
}: {
  page: number
  perPage: number
  search: MyListSearch
  status: LibraryStatus | null
  totalItems: number
  totalPages: number
}) {
  if (totalItems <= perPage) return null

  const from = (page - 1) * perPage + 1
  const to = Math.min(totalItems, page * perPage)
  const statusValue: MyListSearch["status"] = status ?? "all"
  const search = (nextPage: number) => ({
    status: statusValue,
    sort: currentSearch.sort,
    q: currentSearch.q,
    page: nextPage,
  })

  return (
    <nav className="flex flex-col gap-3 rounded-xl border bg-card/80 p-3 sm:flex-row sm:items-center sm:justify-between">
      {page > 1 ? (
        <Button variant="outline" size="sm" asChild>
          <Link to="/my-list" search={search(page - 1)}>
            <ChevronLeft data-icon="inline-start" />
            Previous
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft data-icon="inline-start" />
          Previous
        </Button>
      )}
      <span className="text-center text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground tabular-nums">
          {from}-{to}
        </span>{" "}
        of <span className="tabular-nums">{totalItems}</span> · Page {page} /{" "}
        {totalPages}
      </span>
      {page < totalPages ? (
        <Button variant="outline" size="sm" asChild>
          <Link to="/my-list" search={search(page + 1)}>
            Next
            <ChevronRight data-icon="inline-end" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Next
          <ChevronRight data-icon="inline-end" />
        </Button>
      )}
    </nav>
  )
}

function ImportWatcher({
  id,
  refresh,
  stop,
}: {
  id: string
  refresh: () => void
  stop: () => void
}) {
  const atom = watchLibraryImportAtom(id)
  const result = useAtomValue(atom)
  const pull = useAtomSet(atom)

  useEffect(() => {
    Result.builder(result)
      .onSuccess((value, state) => {
        if (state.waiting) return

        const job = value.items.at(-1)

        if (!job) return

        if (job.status === "completed") {
          refresh()
          toast.success("Import complete")
          stop()
        } else if (job.status === "failed") {
          toast.error(job.errorMessage ?? "Import failed")
          stop()
        } else if (!value.done) {
          pull()
        }
      })
      .orNull()
  }, [pull, refresh, result, stop])

  return null
}

function ClearLibraryDialog({
  open,
  onOpenChange,
  refresh,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  refresh: () => void
}) {
  const [clearResult, clear] = useAtom(clearLibraryAtom, { mode: "promise" })
  const pending = clearResult.waiting

  const clearList = async () => {
    try {
      const result = await clear({
        payload: void 0,
        reactivityKeys: [libraryReactivityKeys.all],
      })

      refresh()
      toast.success(`Removed ${result.removedCount} library entries.`)
      onOpenChange(false)
    } catch {
      toast.error("Unable to clear library")
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Clear your list?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes every local library entry. Linked provider lists are
            not changed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              void clearList()
            }}
          >
            {pending ? "Clearing…" : "Clear list"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function MyListPending() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-36 rounded-xl" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-32 rounded-lg" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    </>
  )
}
