import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { LibraryStatus } from "@workspace/domain"
import type { ExternalListProvider, LibraryEntry } from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form"
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
import { useId } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { AnimeTitle } from "../anime/anime-title"
import { animeTitlePreferenceAtom, getAnimeTitle } from "../anime/title"
import { playerPreferencesAtom } from "../streaming/preferences"
import {
  libraryMutationKeys,
  removeLibraryAtom,
  upsertLibraryAtom,
} from "./atoms"
import { libraryStatuses } from "./constants"
import {
  decodeLibraryProgress,
  decodeLibraryScore,
  libraryDeleteFormDefaults,
  libraryEntryFormDefaults,
} from "./form"
import type { LibraryDeleteFormValues, LibraryEntryFormValues } from "./form"

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
  const formId = useId()
  const form = useForm<LibraryDeleteFormValues>({
    values: libraryDeleteFormDefaults(),
  })
  const submit = async (values: LibraryDeleteFormValues) => {
    const providers: Array<ExternalListProvider> = []
    if (values.mal) providers.push("mal")
    if (values.anilist) providers.push("anilist")
    try {
      await remove({
        payload: { malId: entry.malId, providers },
        reactivityKeys: libraryMutationKeys(entry.malId),
      })
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
        <Form {...form}>
          <form
            className="rounded-xl border p-4"
            id={formId}
            onSubmit={form.handleSubmit(submit)}
          >
            <FieldSet>
              <FieldLegend variant="label">External delete</FieldLegend>
              <FieldGroup className="gap-3">
                <FormField
                  control={form.control}
                  name="mal"
                  render={({ field }) => (
                    <FormItem orientation="horizontal">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                        />
                      </FormControl>
                      <FormLabel>Also delete from MyAnimeList</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="anilist"
                  render={({ field }) => (
                    <FormItem orientation="horizontal">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                        />
                      </FormControl>
                      <FormLabel>Also delete from AniList</FormLabel>
                    </FormItem>
                  )}
                />
              </FieldGroup>
            </FieldSet>
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={form.formState.isSubmitting}
            form={formId}
            type="submit"
            variant="destructive"
          >
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
  const preferences = useAtomValue(playerPreferencesAtom)
  const formId = useId()
  const form = useForm<LibraryEntryFormValues>({
    values: libraryEntryFormDefaults(entry),
  })
  const submit = async (values: LibraryEntryFormValues) => {
    try {
      await save({
        payload: {
          anime: entry.anime,
          status: values.status,
          progress: decodeLibraryProgress(values.progress),
          score: decodeLibraryScore(values.score),
          notes: values.notes.trim() || null,
          syncExternal: preferences.syncLibraryOnFinish,
        },
        reactivityKeys: libraryMutationKeys(entry.malId),
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
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            id={formId}
            onSubmit={form.handleSubmit(submit)}
          >
            <FieldGroup className="gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) =>
                        field.onChange(
                          Schema.decodeUnknownSync(LibraryStatus)(value)
                        )
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
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
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="progress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Progress</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Score (0–100)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </FieldGroup>
          </form>
        </Form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={form.formState.isSubmitting}
            form={formId}
            type="submit"
          >
            Save changes
          </Button>
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
