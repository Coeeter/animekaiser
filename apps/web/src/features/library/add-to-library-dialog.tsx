import type {
  AnimeDetail,
  ExternalListProvider,
  LibraryEntry,
} from "@animekaiser/domain"
import { LibraryStatus } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { Checkbox } from "@animekaiser/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@animekaiser/ui/components/dialog"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@animekaiser/ui/components/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@animekaiser/ui/components/select"
import { Textarea } from "@animekaiser/ui/components/textarea"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { useForm } from "@tanstack/react-form"
import * as Schema from "effect/Schema"
import { BookmarkPlus, ListChecks, Star, Trash2 } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { toast } from "sonner"
import { IconInput } from "../../components/icon-input"
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

export function AddToLibraryDialog({
  anime,
  entry = null,
}: {
  anime: AnimeDetail
  entry?: LibraryEntry | null
}) {
  const save = useAtomSet(upsertLibraryAtom, { mode: "promise" })
  const remove = useAtomSet(removeLibraryAtom, { mode: "promise" })
  const preferences = useAtomValue(playerPreferencesAtom)
  const [open, setOpen] = useState(false)

  const saveFormId = useId()
  const deleteFormId = useId()

  const saveForm = useForm({
    defaultValues: libraryEntryFormDefaults(entry),
    onSubmit: ({ value }) => saveEntry(value),
  })
  const deleteForm = useForm({
    defaultValues: libraryDeleteFormDefaults(),
    onSubmit: ({ value }) => deleteEntry(value),
  })

  useEffect(() => {
    if (!open) return

    saveForm.reset(libraryEntryFormDefaults(entry))
    deleteForm.reset(libraryDeleteFormDefaults())
  }, [entry, open])

  const saveEntry = async (values: LibraryEntryFormValues) => {
    try {
      await save({
        payload: {
          anime: {
            malId: anime.malId,
            aniListId: anime.aniListId,
            title: anime.title,
            coverImage: anime.coverImage,
            episodes: anime.episodes,
            genres: anime.genres,
            seasonYear: anime.seasonYear,
          },
          status: values.status,
          score: decodeLibraryScore(values.score),
          progress: decodeLibraryProgress(values.progress),
          notes: values.notes.trim() || null,
          syncExternal: preferences.syncLibraryOnFinish,
        },
        reactivityKeys: libraryMutationKeys(anime.malId),
      })

      setOpen(false)
      toast.success("Library entry saved")
    } catch {
      toast.error("Log in to add this title to your list")
    }
  }

  const deleteEntry = async (values: LibraryDeleteFormValues) => {
    if (!entry) return

    const providers: Array<ExternalListProvider> = []

    if (values.mal) providers.push("mal")
    if (values.anilist) providers.push("anilist")

    try {
      await remove({
        payload: { malId: anime.malId, providers },
        reactivityKeys: libraryMutationKeys(anime.malId),
      })
      setOpen(false)
      toast.success(
        providers.length
          ? "Removed locally; external deletes queued"
          : "Removed locally"
      )
    } catch {
      toast.error("Unable to remove title")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-fit" variant="outline">
          <BookmarkPlus data-icon="inline-start" />
          {entry ? "Edit Library" : "Add to Library"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {entry ? "Edit library entry" : "Add to your list"}
          </DialogTitle>
          <DialogDescription>
            Track your status, progress, score, and private notes for this
            title.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          id={saveFormId}
          onSubmit={(event) => {
            event.preventDefault()
            void saveForm.handleSubmit()
          }}
        >
          <FieldGroup className="gap-4">
            <saveForm.Field name="status">
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
            </saveForm.Field>
            <saveForm.Field name="progress">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Progress</FieldLabel>
                  <IconInput
                    id={field.name}
                    icon={ListChecks}
                    name={field.name}
                    type="number"
                    min={0}
                    max={anime.episodes ?? undefined}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Field>
              )}
            </saveForm.Field>
            <saveForm.Field name="score">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Score (0–100)</FieldLabel>
                  <IconInput
                    id={field.name}
                    icon={Star}
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
            </saveForm.Field>
            <saveForm.Field name="notes">
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
            </saveForm.Field>
          </FieldGroup>
        </form>
        {entry ? (
          <form
            className="rounded-xl border p-4"
            id={deleteFormId}
            onSubmit={(event) => {
              event.preventDefault()
              void deleteForm.handleSubmit()
            }}
          >
            <FieldSet>
              <FieldLegend variant="label">External delete</FieldLegend>
              <FieldGroup className="gap-3">
                <deleteForm.Field name="mal">
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
                </deleteForm.Field>
                <deleteForm.Field name="anilist">
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
                </deleteForm.Field>
              </FieldGroup>
            </FieldSet>
          </form>
        ) : null}
        <DialogFooter className={entry ? "sm:justify-between" : undefined}>
          {entry ? (
            <deleteForm.Subscribe selector={(state) => state.isSubmitting}>
              {(pending) => (
                <Button
                  disabled={pending}
                  form={deleteFormId}
                  type="submit"
                  variant="destructive"
                >
                  <Trash2 data-icon="inline-start" />
                  Remove title
                </Button>
              )}
            </deleteForm.Subscribe>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <saveForm.Subscribe selector={(state) => state.isSubmitting}>
              {(pending) => (
                <Button disabled={pending} form={saveFormId} type="submit">
                  Save entry
                </Button>
              )}
            </saveForm.Subscribe>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
