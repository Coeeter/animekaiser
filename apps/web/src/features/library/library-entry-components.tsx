import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { useForm } from "@tanstack/react-form"
import { Link } from "@tanstack/react-router"
import type { ExternalListProvider, LibraryEntry } from "@workspace/domain"
import { LibraryStatus } from "@workspace/domain"
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
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
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
import { useEffect, useId, useState } from "react"
import { toast } from "sonner"
import { AnimeTitle } from "../anime/common/anime-title"
import { animeTitlePreferenceAtom, getAnimeTitle } from "../anime/common/title"
import { playerPreferencesAtom } from "../streaming/preferences"
import {
  libraryMutationKeys,
  removeLibraryAtom,
  upsertLibraryAtom,
} from "./atoms"
import { libraryStatuses } from "./constants"
import type { LibraryDeleteFormValues, LibraryEntryFormValues } from "./form"
import {
  decodeLibraryProgress,
  decodeLibraryScore,
  libraryDeleteFormDefaults,
  libraryEntryFormDefaults,
} from "./form"

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
  onChanged,
}: {
  entry: LibraryEntry
  onChanged: () => void
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
          <LibraryDialog entry={entry} onSaved={onChanged} />
          <DeleteLibraryDialog entry={entry} onDeleted={onChanged} />
        </div>
      </div>
    </article>
  )
}

export function DeleteLibraryDialog({
  entry,
  onDeleted,
}: {
  entry: LibraryEntry
  onDeleted: () => void
}) {
  const remove = useAtomSet(removeLibraryAtom, { mode: "promise" })
  const [open, setOpen] = useState(false)
  const formId = useId()

  const form = useForm({
    defaultValues: libraryDeleteFormDefaults(),
    onSubmit: ({ value }) => submit(value),
  })

  useEffect(() => {
    if (open) form.reset(libraryDeleteFormDefaults())
  }, [open])

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
      setOpen(false)
      onDeleted()
    } catch {
      toast.error("Unable to remove title")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 data-icon="inline-start" />
          Remove
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove from your list?</DialogTitle>
          <DialogDescription>
            The Kaiser entry is removed immediately. External deletion is
            optional and explicit.
          </DialogDescription>
        </DialogHeader>
        <form
          className="rounded-xl border p-4"
          id={formId}
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FieldSet>
            <FieldLegend variant="label">External delete</FieldLegend>
            <FieldGroup className="gap-3">
              <form.Field name="mal">
                {(field) => (
                  <Field orientation="horizontal">
                    <Checkbox
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={(checked) =>
                        field.handleChange(checked === true)
                      }
                    />
                    <FieldLabel htmlFor={field.name}>
                      Also delete from MyAnimeList
                    </FieldLabel>
                  </Field>
                )}
              </form.Field>
              <form.Field name="anilist">
                {(field) => (
                  <Field orientation="horizontal">
                    <Checkbox
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={(checked) =>
                        field.handleChange(checked === true)
                      }
                    />
                    <FieldLabel htmlFor={field.name}>
                      Also delete from AniList
                    </FieldLabel>
                  </Field>
                )}
              </form.Field>
            </FieldGroup>
          </FieldSet>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(pending) => (
              <Button
                disabled={pending}
                form={formId}
                type="submit"
                variant="destructive"
              >
                Remove title
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function LibraryDialog({
  entry,
  onSaved,
}: {
  entry: LibraryEntry
  onSaved: () => void
}) {
  const save = useAtomSet(upsertLibraryAtom, { mode: "promise" })
  const preferences = useAtomValue(playerPreferencesAtom)
  const [open, setOpen] = useState(false)
  const formId = useId()

  const form = useForm({
    defaultValues: libraryEntryFormDefaults(entry),
    onSubmit: ({ value }) => submit(value),
  })

  useEffect(() => {
    if (open) form.reset(libraryEntryFormDefaults(entry))
  }, [entry, open])

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
      setOpen(false)
      onSaved()
    } catch {
      toast.error("Unable to update entry")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit3 data-icon="inline-start" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit library entry</DialogTitle>
          <DialogDescription>
            Update your local status, progress, score, and notes.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          id={formId}
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FieldGroup className="gap-4">
            <form.Field name="status">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) =>
                      field.handleChange(
                        Schema.decodeUnknownSync(LibraryStatus)(value)
                      )
                    }
                  >
                    <SelectTrigger id={field.name} className="w-full">
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
              )}
            </form.Field>
            <form.Field name="progress">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Progress</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    min={0}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="score">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Score (0–100)</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    min={0}
                    max={100}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="notes">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Notes</FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Field>
              )}
            </form.Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(pending) => (
              <Button disabled={pending} form={formId} type="submit">
                Save changes
              </Button>
            )}
          </form.Subscribe>
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
