import type {
  ExternalListProvider,
  LibraryPage,
  LibraryStatus,
} from "@animekaiser/domain"
import { LibrarySort } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@animekaiser/ui/components/dialog"
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
  ChevronLeft,
  ChevronRight,
  Download,
  ListRestart,
  SearchX,
  Star,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { DataError } from "../../components/data-error"
import { DebouncedSearchInput } from "../../components/debounced-search-input"
import { PageHero } from "../../components/page-hero"
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 pb-8 md:p-6">
      <PageHero
        icon={Bookmark}
        kicker={`${page?.stats.total ?? 0} titles`}
        title="My list"
        description="Track your anime library, scores, and watch progress."
      />
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

function MyListPending() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <Skeleton className="h-10 w-full rounded-2xl" />
        <Skeleton className="h-11 w-full rounded-2xl" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="hidden flex-col gap-4 lg:flex">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
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
  const navigate = useNavigate()
  const status = search.status === "all" ? null : search.status
  const totalItems = page.total
  const totalPages = page.totalPages
  const currentPage = Math.min(search.page, totalPages)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <main className="flex min-w-0 flex-col gap-4">
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <LibraryStatusTabs search={search} value={status} />
          <LibrarySortSelect search={search} status={status} />
        </div>
        <div
          className={cn(
            "flex flex-col gap-4 transition-opacity",
            stale && "opacity-60"
          )}
        >
          {page.items.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
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
            totalItems={totalItems}
            totalPages={totalPages}
          />
        </div>
      </main>
      <aside className="flex flex-col gap-4">
        <StatsPanel page={page} />
        <SyncActivityPanel />
        <ImportLibraryPanel refresh={refresh} />
        <ClearLibraryPanel
          disabled={page.stats.total === 0}
          refresh={refresh}
        />
      </aside>
    </div>
  )
}

function SyncActivityPanel() {
  return (
    <section className="rounded-xl border bg-card/60 p-4">
      <h2 className="text-sm font-semibold">External sync</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Review failed provider updates and retry them manually.
      </p>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/sync-activity" search={{ page: 1 }}>
          <ListRestart data-icon="inline-start" />
          Sync activity
        </Link>
      </Button>
    </section>
  )
}

function LibraryStatusTabs({
  search,
  value,
}: {
  search: MyListSearch
  value: LibraryStatus | null
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
              className="whitespace-nowrap"
            >
              {status.label}
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
        <SelectTrigger className="w-44">
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
    <nav className="flex flex-col gap-3 rounded-2xl border bg-card/60 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        Showing {from}-{to} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button variant="outline" size="sm" asChild>
            <Link to="/my-list" search={search(page - 1)}>
              <ChevronLeft data-icon="inline-start" />
              Prev
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft data-icon="inline-start" />
            Prev
          </Button>
        )}
        <span className="min-w-20 text-center text-muted-foreground">
          Page {page} / {totalPages}
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
      </div>
    </nav>
  )
}

function StatsPanel({ page }: { page: LibraryPage }) {
  return (
    <section className="rounded-xl border bg-card/60 p-4">
      <h2 className="text-sm font-semibold">Stats</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Total</p>
          <p className="text-lg font-semibold">{page.stats.total}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Mean score</p>
          <p className="inline-flex items-center gap-1 text-lg font-semibold">
            {formatMeanScore(page.stats.meanScore) ?? "-"}
            {page.stats.meanScore !== null ? (
              <Star className="size-4 fill-amber-400 text-amber-500" />
            ) : null}
          </p>
        </div>
      </div>
    </section>
  )
}

function ImportLibraryPanel({ refresh }: { refresh: () => void }) {
  const startLibraryImport = useAtomSet(startLibraryImportAtom, {
    mode: "promise",
  })
  const [pendingProvider, setPendingProvider] =
    useState<ExternalListProvider | null>(null)
  const [watchingJobId, setWatchingJobId] = useState<string | null>(null)

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
    <section className="rounded-xl border bg-card/60 p-4">
      {watchingJobId ? (
        <ImportWatcher
          id={watchingJobId}
          refresh={refresh}
          stop={() => setWatchingJobId(null)}
        />
      ) : null}
      <h2 className="text-sm font-semibold">Import</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Start a provider import after linking your MAL or AniList account in
        Settings.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pendingProvider !== null}
          onClick={() => void start("mal")}
        >
          <Download data-icon="inline-start" />
          {pendingProvider === "mal" ? "Importing..." : "MAL"}
        </Button>
        <Button
          variant="outline"
          disabled={pendingProvider !== null}
          onClick={() => void start("anilist")}
        >
          <Download data-icon="inline-start" />
          {pendingProvider === "anilist" ? "Importing..." : "AniList"}
        </Button>
      </div>
    </section>
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

function ClearLibraryPanel({
  disabled,
  refresh,
}: {
  disabled: boolean
  refresh: () => void
}) {
  const [clearResult, clear] = useAtom(clearLibraryAtom, { mode: "promise" })
  const [open, setOpen] = useState(false)

  const clearList = async () => {
    try {
      const result = await clear({
        payload: void 0,
        reactivityKeys: [libraryReactivityKeys.all],
      })

      refresh()
      toast.success(`Removed ${result.removedCount} library entries.`)
      setOpen(false)
    } catch {
      toast.error("Unable to clear library")
    }
  }

  return (
    <section className="rounded-xl border border-destructive/30 bg-card/60 p-4">
      <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Remove every title from your local list. Linked provider lists are not
        changed.
      </p>
      <Button
        type="button"
        variant="destructive"
        className="mt-4 w-full"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Trash2 data-icon="inline-start" />
        Clear my list
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear your list?</DialogTitle>
            <DialogDescription>
              This removes every local library entry. Linked provider lists are
              not changed.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void clearList()
            }}
          >
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={clearResult.waiting}
              >
                <Trash2 data-icon="inline-start" />
                {clearResult.waiting ? "Clearing..." : "Clear list"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
