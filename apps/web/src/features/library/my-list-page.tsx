import {
  Result,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import type { ExternalListProvider, LibraryEntry } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import {
  Bookmark,
  Download,
  ListRestart,
  Settings2,
  Trash2,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { PageHero } from "../../components/page-hero"
import { clearLibraryAtom, libraryPageAtom } from "./atoms"
import { startLibraryImport, watchLibraryImport } from "./import-rpc"
import type { MyListSearch } from "./search"

import { librarySorts, libraryStatuses } from "./constants"
import {
  DeleteLibraryDialog,
  LibraryCard,
  LibraryDialog,
  LibraryStat,
  StatsSkeleton,
} from "./library-entry-components"

export function MyListPage({ search }: { search: MyListSearch }) {
  const queryAtom = useMemo(
    () =>
      libraryPageAtom({
        status: search.status === "all" ? undefined : search.status,
        sort: search.sort,
        page: search.page,
        perPage: 30,
      }),
    [search.page, search.sort, search.status]
  )
  const result = useAtomValue(queryAtom)
  const refresh = useAtomRefresh(queryAtom)
  const clear = useAtomSet(clearLibraryAtom, { mode: "promise" })
  const [editing, setEditing] = useState<LibraryEntry | null>(null)
  const [deleting, setDeleting] = useState<LibraryEntry | null>(null)
  const [busy, setBusy] = useState(false)

  const importFrom = async (provider: ExternalListProvider) => {
    setBusy(true)
    try {
      const started = await startLibraryImport(provider)
      toast.success(`${provider === "mal" ? "MAL" : "AniList"} import queued`)
      void watchLibraryImport(started.id, (job) => {
        if (job.status === "completed") {
          refresh()
          toast.success(
            `Import complete: ${job.result?.insertedCount ?? 0} added, ${job.result?.updatedCount ?? 0} updated`
          )
        } else if (job.status === "failed")
          toast.error(job.errorMessage ?? "Import failed")
      })
    } catch {
      toast.error("Connect this provider in Settings first")
    } finally {
      setBusy(false)
    }
  }
  const clearAll = async () => {
    if (
      !window.confirm(
        "Remove every local library entry? This does not delete external lists."
      )
    )
      return
    try {
      await clear(undefined)
      refresh()
      toast.success("Library cleared")
    } catch {
      toast.error("Unable to clear library")
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 p-4 pb-10 md:p-6">
      <nav className="flex gap-2 text-sm text-muted-foreground">
        <Link to="/">Home</Link>
        <span>/</span>
        <span className="text-foreground">My List</span>
      </nav>
      <PageHero
        icon={Bookmark}
        kicker="Your library"
        title="My List"
        description="Track progress, scores, and notes across the shows you watch."
      >
        <Button
          variant="outline"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("kaiser:settings", { detail: "Integrations" })
            )
          }
        >
          <Settings2 />
          Integrations
        </Button>
      </PageHero>
      <div className="grid gap-4 rounded-2xl border bg-card/70 p-4 sm:grid-cols-3">
        {Result.match(result, {
          onInitial: () => <StatsSkeleton />,
          onFailure: () => (
            <p className="text-sm text-destructive">Unable to load library.</p>
          ),
          onSuccess: ({ value: page }) => (
            <>
              <LibraryStat label="Total titles" value={page.stats.total} />
              <LibraryStat
                label="Watching"
                value={page.stats.byStatus.watching}
              />
              <LibraryStat
                label="Mean score"
                value={
                  page.stats.meanScore === null
                    ? "—"
                    : `${page.stats.meanScore}%`
                }
              />
            </>
          ),
        })}
      </div>
      <section className="flex flex-col gap-3 rounded-2xl border bg-card/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold">Import your library</h2>
            <p className="text-sm text-muted-foreground">
              Existing entries are updated locally; imports never fan out to
              another provider.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void importFrom("mal")}
            >
              <Download />
              MAL
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void importFrom("anilist")}
            >
              <Download />
              AniList
            </Button>
          </div>
        </div>
      </section>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={search.status}>
          <TabsList className="h-auto max-w-full justify-start overflow-x-auto">
            {libraryStatuses.map((status) => (
              <TabsTrigger key={status.value} value={status.value} asChild>
                <Link
                  to="/my-list"
                  search={{ ...search, status: status.value, page: 1 }}
                >
                  {status.label}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <select
            value={search.sort}
            onChange={(event) => {
              window.location.href = `/my-list?status=${search.status}&sort=${event.target.value}&page=1`
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {librarySorts.map((sort) => (
              <option key={sort} value={sort}>
                {sort.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <Button variant="outline" size="icon" title="Sync activity" asChild>
            <Link to="/sync-activity" search={{ page: 1 }}>
              <ListRestart />
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="icon"
            title="Clear local library"
            onClick={() => void clearAll()}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      {Result.match(result, {
        onInitial: () => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-xl bg-muted"
              />
            ))}
          </div>
        ),
        onFailure: () => (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            Unable to load your list.
          </div>
        ),
        onSuccess: ({ value: page }) =>
          page.items.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            <div className="rounded-xl border border-dashed p-12 text-center">
              <Bookmark className="mx-auto mb-4 size-8 text-muted-foreground" />
              <h2 className="font-heading text-xl font-bold">
                Your list is empty
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Browse the catalog or import an external list.
              </p>
            </div>
          ),
      })}
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
    </main>
  )
}
