import type { KeyBinding } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  setShortcutOverridesAtom,
  shortcutOverridesAtom,
  shortcutsAtom,
} from "../shortcuts/atoms"
import {
  bindingFromEvent,
  formatBinding,
  type ShortcutActionId,
  sameBinding,
  shortcutActions,
} from "../shortcuts/shortcuts"
import { SettingCard, SettingHeading } from "./settings-shared"

const groups = ["General", "Player"] as const

export function ShortcutsPanel() {
  const shortcuts = useAtomValue(shortcutsAtom)
  const overrides = useAtomValue(shortcutOverridesAtom)
  const setOverrides = useAtomSet(setShortcutOverridesAtom)
  const [recording, setRecording] = useState<ShortcutActionId | null>(null)

  // Capture runs before the player and search listeners, so the key being
  // recorded never also triggers its current action.
  useEffect(() => {
    if (!recording) return
    const keydown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.key === "Escape") {
        setRecording(null)
        return
      }
      const binding = bindingFromEvent(event)
      if (!binding) return

      const owner = shortcutActions.find(
        (action) =>
          action.id !== recording &&
          shortcuts[action.id].some((other) => sameBinding(other, binding))
      )
      if (owner) {
        toast.error(
          `${formatBinding(binding)} is already used for ${owner.label}.`
        )
        return
      }
      setOverrides({ ...overrides, [recording]: [binding] })
      setRecording(null)
    }
    window.addEventListener("keydown", keydown, { capture: true })
    return () =>
      window.removeEventListener("keydown", keydown, { capture: true })
  }, [recording, shortcuts, overrides, setOverrides])

  const reset = (action: ShortcutActionId) => {
    const { [action]: _removed, ...rest } = overrides
    setOverrides(rest)
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <SettingCard key={group} id={`shortcuts.${group.toLowerCase()}`}>
          <SettingHeading
            title={group}
            description={
              group === "General"
                ? "Work anywhere in the app."
                : "Work on the watch page, unless you're typing in a field."
            }
          />
          <ul className="mt-3 flex flex-col divide-y">
            {shortcutActions
              .filter((action) => action.group === group)
              .map((action) => (
                <ShortcutRow
                  key={action.id}
                  label={action.label}
                  bindings={shortcuts[action.id]}
                  changed={action.id in overrides}
                  recording={recording === action.id}
                  onRecord={() =>
                    setRecording(recording === action.id ? null : action.id)
                  }
                  onReset={() => reset(action.id)}
                />
              ))}
          </ul>
        </SettingCard>
      ))}
      {Object.keys(overrides).length > 0 ? (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setOverrides({})}>
            <RotateCcw data-icon="inline-start" />
            Reset all shortcuts
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function ShortcutRow({
  label,
  bindings,
  changed,
  recording,
  onRecord,
  onReset,
}: {
  label: string
  bindings: ReadonlyArray<KeyBinding>
  changed: boolean
  recording: boolean
  onRecord: () => void
  onReset: () => void
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="min-w-0 flex-1 text-sm">{label}</span>
      {changed ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Reset ${label} to default`}
          onClick={onReset}
        >
          <RotateCcw />
        </Button>
      ) : null}
      <button
        type="button"
        onClick={onRecord}
        aria-label={`Change shortcut for ${label}`}
        className={cn(
          "flex min-w-28 items-center justify-end gap-1 rounded-lg px-2 py-1 transition hover:bg-accent",
          recording && "bg-primary/15 ring-1 ring-primary"
        )}
      >
        {recording ? (
          <span className="text-xs text-muted-foreground">
            Press a key… (Esc to cancel)
          </span>
        ) : (
          bindings.map((binding) => (
            <kbd
              key={`${binding.mod}-${binding.key}`}
              className="min-w-6 rounded-md border bg-muted px-1.5 py-0.5 text-center font-mono text-xs"
            >
              {formatBinding(binding)}
            </kbd>
          ))
        )}
      </button>
    </li>
  )
}
