import type { AnimeItem, RecapMode, RecapRequest } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { Checkbox } from "@animekaiser/ui/components/checkbox"
import { Input } from "@animekaiser/ui/components/input"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@animekaiser/ui/components/toggle-group"
import { useAtomValue } from "@effect/atom-react"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { getAnimeTitle } from "../anime/common/title"
import { watchOrderAtom } from "../anime/detail/atoms"

const titleOf = (anime: AnimeItem) => getAnimeTitle(anime.title, "english")

type Selection = Record<number, { checked: boolean; through: string }>

export function RecapPicker({
  malId,
  currentEpisode,
  busy,
  onConfirm,
}: {
  malId: number
  currentEpisode: number | null
  busy: boolean
  onConfirm: (request: RecapRequest, description: string) => void
}) {
  const result = useAtomValue(watchOrderAtom(malId))
  return AsyncResult.builder(result)
    .onInitialOrWaiting(() => (
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    ))
    .onFailure(() => (
      <p className="text-sm text-muted-foreground">
        The watch order couldn't be loaded, so the recap range can't be
        confirmed. Try again later.
      </p>
    ))
    .onSuccess((order) => (
      <RecapPickerForm
        entries={order.entries}
        malId={malId}
        currentEpisode={currentEpisode}
        busy={busy}
        onConfirm={onConfirm}
      />
    ))
    .render()
}

function RecapPickerForm({
  entries,
  malId,
  currentEpisode,
  busy,
  onConfirm,
}: {
  entries: ReadonlyArray<AnimeItem>
  malId: number
  currentEpisode: number | null
  busy: boolean
  onConfirm: (request: RecapRequest, description: string) => void
}) {
  const index = entries.findIndex((entry) => entry.malId === malId)
  const target = index >= 0 ? entries[index] : null
  const prior = index > 0 ? entries.slice(0, index) : []
  const [mode, setMode] = useState<RecapMode>("quick")
  const [selection, setSelection] = useState<Selection>(() => {
    const initial: Selection = {}
    prior.forEach((entry, position) => {
      initial[entry.malId] = {
        checked: position === prior.length - 1,
        through: entry.episodes ? String(entry.episodes) : "",
      }
    })
    if (target)
      initial[target.malId] = {
        checked: (currentEpisode ?? 1) > 1,
        through:
          currentEpisode && currentEpisode > 1
            ? String(currentEpisode - 1)
            : "",
      }
    return initial
  })

  if (!target)
    return (
      <p className="text-sm text-muted-foreground">
        This anime isn't in its franchise watch order yet, so a recap range
        can't be confirmed.
      </p>
    )

  const ranges = [...prior, target].flatMap((entry) => {
    const choice = selection[entry.malId]
    const through = Number(choice?.through)
    if (!choice?.checked || !Number.isInteger(through) || through < 1) return []
    if (entry.episodes !== null && through > entry.episodes) return []
    return [
      {
        malId: entry.malId,
        title: titleOf(entry),
        fromEpisode: 1,
        toEpisode: through,
      },
    ]
  })
  const targetRange = ranges.find((range) => range.malId === target.malId)
  const excludes = targetRange
    ? `${titleOf(target)} after episode ${targetRange.toEpisode} and anything later`
    : `${titleOf(target)} and anything later`
  const contains = ranges
    .map(
      (range) => `${range.title} (ep ${range.fromEpisode}–${range.toEpisode})`
    )
    .join(", ")
  const invalid = [...prior, target].some((entry) => {
    const choice = selection[entry.malId]
    if (!choice?.checked) return false
    const through = Number(choice.through)
    return (
      !Number.isInteger(through) ||
      through < 1 ||
      (entry.episodes !== null && through > entry.episodes)
    )
  })

  const update = (id: number, patch: Partial<Selection[number]>) =>
    setSelection((current) => ({
      ...current,
      [id]: { ...(current[id] ?? { checked: false, through: "" }), ...patch },
    }))

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Choose exactly what to recap. Entries come from the MAL watch order;
        check the numbering before you confirm.
      </p>
      <ul className="flex flex-col gap-2">
        {[...prior, target].map((entry) => {
          const choice = selection[entry.malId]
          const id = `recap-${entry.malId}`
          return (
            <li
              key={entry.malId}
              className="flex items-center gap-3 rounded-xl border p-2"
            >
              <Checkbox
                id={id}
                checked={choice?.checked ?? false}
                onCheckedChange={(checked) =>
                  update(entry.malId, { checked: checked === true })
                }
              />
              <label htmlFor={id} className="min-w-0 flex-1 text-sm">
                <span className="line-clamp-1">{titleOf(entry)}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.malId === target.malId
                    ? "Current entry"
                    : (entry.format ?? "")}
                  {entry.episodes
                    ? ` · ${entry.episodes} eps`
                    : " · episode count unknown"}
                </span>
              </label>
              <span className="text-xs text-muted-foreground">through ep</span>
              <Input
                aria-label={`Last episode of ${titleOf(entry)} to include`}
                className="h-8 w-16"
                inputMode="numeric"
                value={choice?.through ?? ""}
                onChange={(event) =>
                  update(entry.malId, {
                    through: event.currentTarget.value.replace(/\D/g, ""),
                    checked: true,
                  })
                }
              />
            </li>
          )
        })}
      </ul>
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(value) => {
          if (value) setMode(value as RecapMode)
        }}
        variant="outline"
      >
        <ToggleGroupItem value="quick">Quick catch-up</ToggleGroupItem>
        <ToggleGroupItem value="episodes">Episode by episode</ToggleGroupItem>
      </ToggleGroup>
      <div role="status" className="rounded-xl bg-muted p-3 text-sm">
        {ranges.length > 0 ? (
          <>
            <p>
              <span className="font-medium">Contains spoilers for:</span>{" "}
              {contains}
            </p>
            <p>
              <span className="font-medium">Excludes:</span> {excludes}
            </p>
          </>
        ) : (
          <p>Select at least one range.</p>
        )}
      </div>
      <Button
        disabled={busy || invalid || ranges.length === 0}
        onClick={() =>
          onConfirm(
            { entries: ranges, mode, excludes },
            `Catch me up: ${contains} (${mode === "quick" ? "quick" : "episode by episode"})`
          )
        }
      >
        Confirm spoilers and generate
      </Button>
    </div>
  )
}
