import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { LibraryStatus } from "@workspace/domain"
import type {
  AnimeDetail,
  ExternalListProvider,
  LibraryEntry,
} from "@workspace/domain"
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
import { Trash2 } from "lucide-react"
import { useId } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
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

export function AddToLibraryDialog({
  anime,
  open,
  onOpenChange,
  entry = null,
}: {
  anime: AnimeDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  entry?: LibraryEntry | null
}) {
  const save = useAtomSet(upsertLibraryAtom, { mode: "promise" })
  const remove = useAtomSet(removeLibraryAtom, { mode: "promise" })
  const preferences = useAtomValue(playerPreferencesAtom)
  const saveFormId = useId()
  const deleteFormId = useId()
  const saveForm = useForm<LibraryEntryFormValues>({
    values: libraryEntryFormDefaults(entry),
  })
  const deleteForm = useForm<LibraryDeleteFormValues>({
    values: libraryDeleteFormDefaults(),
  })

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
          },
          status: values.status,
          score: decodeLibraryScore(values.score),
          progress: decodeLibraryProgress(values.progress),
          notes: values.notes.trim() || null,
          syncExternal: preferences.syncLibraryOnFinish,
        },
        reactivityKeys: libraryMutationKeys(anime.malId),
      })
      onOpenChange(false)
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
      onOpenChange(false)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
        <Form {...saveForm}>
          <form
            className="flex flex-col gap-4"
            id={saveFormId}
            onSubmit={saveForm.handleSubmit(saveEntry)}
          >
            <FieldGroup className="gap-4">
              <FormField
                control={saveForm.control}
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
                control={saveForm.control}
                name="progress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Progress</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={anime.episodes ?? undefined}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={saveForm.control}
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
                control={saveForm.control}
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
        {entry ? (
          <Form {...deleteForm}>
            <form
              className="rounded-xl border p-4"
              id={deleteFormId}
              onSubmit={deleteForm.handleSubmit(deleteEntry)}
            >
              <FieldSet>
                <FieldLegend variant="label">External delete</FieldLegend>
                <FieldGroup className="gap-3">
                  <FormField
                    control={deleteForm.control}
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
                    control={deleteForm.control}
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
        ) : null}
        <DialogFooter className={entry ? "sm:justify-between" : undefined}>
          {entry ? (
            <Button
              disabled={deleteForm.formState.isSubmitting}
              form={deleteFormId}
              type="submit"
              variant="destructive"
            >
              <Trash2 data-icon="inline-start" />
              Remove title
            </Button>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={saveForm.formState.isSubmitting}
              form={saveFormId}
              type="submit"
            >
              Save entry
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
