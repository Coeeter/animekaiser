import {
  Result,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import type {
  ExternalListProvider,
  LibraryEntry,
  LibrarySort,
  LibraryStatus,
} from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
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
import {
  animeTitlePreferenceAtom,
  getAnimeTitle,
} from "../anime/title"
import {
  clearLibraryAtom,
  libraryPageAtom,
  removeLibraryAtom,
  upsertLibraryAtom,
} from "./atoms"
import { startLibraryImport, watchLibraryImport } from "./import-rpc"
import type { MyListSearch } from "./search"

const statuses: ReadonlyArray<{ value: "all" | LibraryStatus; label: string }> =
  [
    { value: "all", label: "All" },
    { value: "watching", label: "Watching" },
    { value: "completed", label: "Completed" },
    { value: "planning", label: "Planning" },
    { value: "paused", label: "Paused" },
    { value: "dropped", label: "Dropped" },
    { value: "rewatching", label: "Rewatching" },
  ]
const sorts: ReadonlyArray<LibrarySort> = [
  "updated_desc",
  "updated_asc",
  "title_asc",
  "score_desc",
  "progress_desc",
]

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
              <Stat label="Total titles" value={page.stats.total} />
              <Stat label="Watching" value={page.stats.byStatus.watching} />
              <Stat
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
            {statuses.map((status) => (
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
            {sorts.map((sort) => (
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

function LibraryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: LibraryEntry
  onEdit: () => void
  onDelete: () => void
}) {
  const preference = useAtomValue(animeTitlePreferenceAtom)
  return (
    <article className="flex gap-4 rounded-xl border bg-card p-3 shadow-sm">
      {entry.anime.coverImage ? (
        <Link to="/series/$id" params={{ id: entry.malId }}>
          <img
            src={entry.anime.coverImage}
            alt=""
            className="aspect-2/3 w-24 rounded-lg object-cover"
          />
        </Link>
      ) : (
        <div className="aspect-2/3 w-24 rounded-lg bg-muted" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          to="/series/$id"
          params={{ id: entry.malId }}
          className="line-clamp-2 font-semibold hover:text-primary"
        >
          {getAnimeTitle(entry.anime.title, preference)}
        </Link>
        <Badge variant="secondary" className="mt-2 w-fit capitalize">
          {entry.status}
        </Badge>
        <p className="mt-3 text-sm text-muted-foreground">
          {entry.progress}
          {entry.anime.episodes ? ` / ${entry.anime.episodes}` : ""} episodes
        </p>
        <p className="text-sm text-muted-foreground">
          Score: {entry.score === null ? "—" : `${entry.score}%`}
        </p>
        <div className="mt-auto flex gap-2 pt-3">
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onDelete}>
            <Trash2 />
          </Button>
        </div>
      </div>
    </article>
  )
}

function DeleteLibraryDialog({
  entry,
  open,
  onOpenChange,
  onDeleted,
}: {
  entry: LibraryEntry
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const remove = useAtomSet(removeLibraryAtom, { mode: "promise" })
  const [mal, setMal] = useState(false)
  const [anilist, setAniList] = useState(false)
  const submit = async () => {
    const providers: Array<ExternalListProvider> = []
    if (mal) providers.push("mal")
    if (anilist) providers.push("anilist")
    try {
      await remove({ malId: entry.malId, providers })
      toast.success(
        providers.length
          ? "Removed locally; external deletes queued"
          : "Removed locally"
      )
      onDeleted()
    } catch {
      toast.error("Unable to remove title")
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove from your list?</DialogTitle>
          <DialogDescription>
            The Kaiser entry is removed immediately. External deletion is
            optional and explicit.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 rounded-xl border p-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={mal}
              onChange={(event) => setMal(event.target.checked)}
            />
            Also delete from MyAnimeList
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={anilist}
              onChange={(event) => setAniList(event.target.checked)}
            />
            Also delete from AniList
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void submit()}>
            Remove title
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LibraryDialog({
  entry,
  open,
  onOpenChange,
  onSaved,
}: {
  entry: LibraryEntry
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const save = useAtomSet(upsertLibraryAtom, { mode: "promise" })
  const [status, setStatus] = useState<LibraryStatus>(entry.status)
  const [progress, setProgress] = useState(entry.progress)
  const [score, setScore] = useState(entry.score?.toString() ?? "")
  const [notes, setNotes] = useState(entry.notes ?? "")
  const submit = async () => {
    try {
      await save({
        anime: entry.anime,
        status,
        progress,
        score: score ? Number(score) : null,
        notes: notes.trim() || null,
      })
      toast.success("Library entry updated")
      onSaved()
    } catch {
      toast.error("Unable to update entry")
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit library entry</DialogTitle>
          <DialogDescription>
            Update your local status, progress, score, and notes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm">
            Status
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as LibraryStatus)
              }
              className="h-9 rounded-md border bg-background px-3"
            >
              {statuses
                .filter(({ value }) => value !== "all")
                .map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            Progress
            <Input
              type="number"
              min={0}
              value={progress}
              onChange={(event) => setProgress(Number(event.target.value))}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            Score (0–100)
            <Input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(event) => setScore(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            Notes
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-3xl font-black">{value}</p>
    </div>
  )
}
function StatsSkeleton() {
  return (
    <div className="col-span-full h-16 animate-pulse rounded-xl bg-muted" />
  )
}
