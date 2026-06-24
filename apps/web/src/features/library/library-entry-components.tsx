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
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import * as Schema from "effect/Schema"
import { Edit3, Star, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AnimeTitle } from "../anime/anime-title"
import { animeTitlePreferenceAtom, getAnimeTitle } from "../anime/title"
import { removeLibraryAtom, upsertLibraryAtom } from "./atoms"
import { libraryStatuses } from "./constants"

const libraryStatusLabel = (status: LibraryStatus) =>
  libraryStatuses.find((item) => item.value === status)?.label ?? status

const formatScore = (score: number | null) => {
  if (score === null) return null
  const value = score / 10
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

const formatProgress = (entry: LibraryEntry) =>
  entry.anime.episodes
    ? `Watched ${entry.progress}/${entry.anime.episodes} ep`
    : `Watched ${entry.progress} ep`

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
  const titleText = getAnimeTitle(entry.anime.title, preference)
  const score = formatScore(entry.score)
  return (
    <article className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 rounded-xl border bg-card/70 p-3">
      <Link to="/series/$id" params={{ id: entry.malId }} preload="intent">
        {entry.anime.coverImage ? (
          <img
            src={entry.anime.coverImage}
            alt={titleText}
            className="aspect-2/3 w-full rounded-lg object-cover"
          />
        ) : (
          <div className="flex aspect-2/3 w-full items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
            MAL #{entry.malId}
          </div>
        )}
      </Link>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="min-w-0">
          <Link
            to="/series/$id"
            params={{ id: entry.malId }}
            preload="intent"
            className="line-clamp-2 text-sm font-semibold hover:underline"
          >
            <AnimeTitle title={entry.anime.title} />
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{formatProgress(entry)}</span>
            {score ? (
              <span className="inline-flex items-center gap-1 text-foreground">
                {score}
                <Star className="size-3 fill-amber-400 text-amber-500" />
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{libraryStatusLabel(entry.status)}</Badge>
        </div>
        <div className="mt-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit3 data-icon="inline-start" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 data-icon="inline-start" />
            Remove
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
      await remove({ payload: { malId: entry.malId, providers } })
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
        payload: {
          anime: entry.anime,
          status,
          progress,
          score: score ? Number(score) : null,
          notes: notes.trim() || null,
        },
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
          <Field>
            <FieldLabel htmlFor="edit-library-status">Status</FieldLabel>
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(Schema.decodeUnknownSync(LibraryStatus)(value))
              }
            >
              <SelectTrigger id="edit-library-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {libraryStatuses
                    .filter(({ value }) => value !== "all")
                    .map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
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
