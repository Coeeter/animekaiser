import { useAtomSet } from "@effect-atom/atom-react"
import { LibraryStatus } from "@workspace/domain"
import type { AnimeDetail } from "@workspace/domain"
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
import { useState } from "react"
import { toast } from "sonner"
import { upsertLibraryAtom } from "./atoms"

export function AddToLibraryDialog({
  anime,
  open,
  onOpenChange,
}: {
  anime: AnimeDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useAtomSet(upsertLibraryAtom, { mode: "promise" })
  const [status, setStatus] = useState<LibraryStatus>("planning")
  const [progress, setProgress] = useState(0)
  const [score, setScore] = useState("")
  const [notes, setNotes] = useState("")

  const submit = async () => {
    try {
      await save({
        anime: {
          malId: anime.malId,
          aniListId: anime.aniListId,
          title: anime.title,
          coverImage: anime.coverImage,
          episodes: anime.episodes,
        },
        status,
        score: score ? Number(score) : null,
        progress,
        notes: notes.trim() || null,
      })
      onOpenChange(false)
      toast.success("Library entry saved")
    } catch {
      toast.error("Log in to add this title to your list")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to your list</DialogTitle>
          <DialogDescription>
            Track your status, progress, score, and private notes for this
            title.
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
              <option value="planning">Planning</option>
              <option value="watching">Watching</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
              <option value="dropped">Dropped</option>
              <option value="rewatching">Rewatching</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            Progress
            <Input
              type="number"
              min={0}
              max={anime.episodes ?? undefined}
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
          <Button onClick={() => void submit()}>Save entry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
