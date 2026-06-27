import {
  Result,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link, useNavigate } from "@tanstack/react-router"
import { LibrarySort } from "@workspace/domain"
import type {
  ExternalListProvider,
  LibraryEntry,
  LibraryPage,
  LibraryStatus,
} from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import * as Schema from "effect/Schema"
import {
  ArrowDownWideNarrow,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  Star,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { PageHero } from "../../components/page-hero"
import {
  clearLibraryAtom,
  libraryPageAtom,
  libraryReactivityKeys,
} from "./atoms"
import { librarySorts, libraryStatuses } from "./constants"
import { startLibraryImport, watchLibraryImport } from "./import-rpc"
import {
  DeleteLibraryDialog,
  LibraryCard,
  LibraryDialog,
} from "./library-entry-components"
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
    30
  )
  const result = useAtomValue(queryAtom)
  const refresh = useAtomRefresh(queryAtom)
  const page = Result.match(result, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  })

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 pb-8 md:p-6">
      <PageHero
        icon={Bookmark}
        kicker={`${page?.stats.total ?? 0} titles`}
        title="My list"
        description="Track your anime library, scores, and watch progress."
      />
      {page ? (
        <MyListContent page={page} search={search} refresh={refresh} />
      ) : (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      )}
    </div>
  )
}

function MyListContent({
  page,
  search,
  refresh,
}: {
  page: LibraryPage
  search: MyListSearch
  refresh: () => void
}) {
  const status = search.status === "all" ? null : search.status
  const totalItems = page.total
  const totalPages = page.totalPages
  const currentPage = Math.min(search.page, totalPages)
  const [editing, setEditing] = useState<LibraryEntry | null>(null)
  const [deleting, setDeleting] = useState<LibraryEntry | null>(null)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <main className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <LibraryStatusTabs sort={search.sort} value={status} />
          <LibrarySortSelect sort={search.sort} status={status} />
        </div>
        {page.items.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {page.items.map((entry) => (
              <LibraryCard
                key={entry.malId}
                entry={entry}
                onEdit={() => setEditing(entry)}
                onDelete={() => setDeleting(entry)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-card/60 p-6">
            <h2 className="text-sm font-semibold">No titles found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add a title from a series page or import a linked provider list.
            </p>
          </div>
        )}
        <LibraryPagination
          page={currentPage}
          perPage={page.perPage}
          sort={search.sort}
          status={status}
          totalItems={totalItems}
          totalPages={totalPages}
        />
      </main>
      <aside className="flex flex-col gap-4">
        <StatsPanel page={page} />
        <ImportLibraryPanel refresh={refresh} />
        <ClearLibraryPanel disabled={page.stats.total === 0} refresh={refresh} />
      </aside>
      {editing ? (
        <LibraryDialog
          entry={editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteLibraryDialog
          entry={deleting}
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(null)
          }}
          onDeleted={() => {
            setDeleting(null)
            refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function LibraryStatusTabs({
  sort,
  value,
}: {
  sort: LibrarySort
  value: LibraryStatus | null
}) {
  return (
    <Tabs value={value ?? "all"} className="w-full">
      <TabsList className="h-auto w-full justify-start overflow-x-auto border bg-card p-1">
        {libraryStatuses.map((status) => (
          <TabsTrigger key={status.value} value={status.value} asChild>
            <Link
              to="/my-list"
              search={{ sort, status: status.value, page: 1 }}
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
  sort,
  status,
}: {
  sort: LibrarySort
  status: LibraryStatus | null
}) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center gap-2">
      <ArrowDownWideNarrow className="size-4 text-muted-foreground" />
      <Select
        value={sort}
        onValueChange={(value) =>
          void navigate({
            to: "/my-list",
            search: {
              status: status ?? "all",
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
  sort,
  status,
  totalItems,
  totalPages,
}: {
  page: number
  perPage: number
  sort: LibrarySort
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
    sort,
    page: nextPage,
  })

  return (
    <nav className="flex flex-col gap-3 rounded-xl border bg-card/60 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
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
  const [pendingProvider, setPendingProvider] =
    useState<ExternalListProvider | null>(null)

  const start = async (provider: ExternalListProvider) => {
    setPendingProvider(provider)
    try {
      const job = await startLibraryImport(provider)
      toast.success(`Import queued: ${job.id}`)
      void watchLibraryImport(job.id, (next) => {
        if (next.status === "completed") {
          refresh()
          toast.success("Import complete")
        } else if (next.status === "failed") {
          toast.error(next.errorMessage ?? "Import failed")
        }
      })
    } catch {
      toast.error("Connect this provider in Settings first")
    } finally {
      setPendingProvider(null)
    }
  }

  return (
    <section className="rounded-xl border bg-card/60 p-4">
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

function ClearLibraryPanel({
  disabled,
  refresh,
}: {
  disabled: boolean
  refresh: () => void
}) {
  const clear = useAtomSet(clearLibraryAtom, { mode: "promise" })
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const clearList = async () => {
    setPending(true)
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
    } finally {
      setPending(false)
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
              <Button type="submit" variant="destructive" disabled={pending}>
                <Trash2 data-icon="inline-start" />
                {pending ? "Clearing..." : "Clear list"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
