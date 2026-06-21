import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { LibraryStatus } from "@workspace/domain"
import type { ExternalListProvider, LibraryEntry } from "@workspace/domain"
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
import { Textarea } from "@workspace/ui/components/textarea"
import * as Schema from "effect/Schema"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { animeTitlePreferenceAtom, getAnimeTitle } from "../anime/title"
import { removeLibraryAtom, upsertLibraryAtom } from "./atoms"
import { libraryStatuses } from "./constants"

export function LibraryCard({
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

export function DeleteLibraryDialog({
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

export function LibraryDialog({
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
                setStatus(
                  Schema.decodeUnknownSync(LibraryStatus)(event.target.value)
                )
              }
              className="h-9 rounded-md border bg-background px-3"
            >
              {libraryStatuses
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

export function LibraryStat({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-3xl font-black">{value}</p>
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div className="col-span-full h-16 animate-pulse rounded-xl bg-muted" />
  )
}
