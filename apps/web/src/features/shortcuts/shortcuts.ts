import type { KeyBinding, ShortcutOverrides } from "@animekaiser/domain"

export const shortcutActions = [
  {
    id: "search",
    group: "General",
    label: "Search anime",
    defaults: [
      { key: "k", mod: true },
      { key: "/", mod: false },
    ],
  },
  {
    id: "toggleSidebar",
    group: "General",
    label: "Toggle sidebar",
    defaults: [{ key: "b", mod: true }],
  },
  {
    id: "playPause",
    group: "Player",
    label: "Play or pause",
    defaults: [
      { key: " ", mod: false },
      { key: "k", mod: false },
    ],
  },
  {
    id: "seekBack",
    group: "Player",
    label: "Back 10 seconds",
    defaults: [
      { key: "arrowleft", mod: false },
      { key: "j", mod: false },
    ],
  },
  {
    id: "seekForward",
    group: "Player",
    label: "Forward 10 seconds",
    defaults: [
      { key: "arrowright", mod: false },
      { key: "l", mod: false },
    ],
  },
  {
    id: "volumeUp",
    group: "Player",
    label: "Volume up",
    defaults: [{ key: "arrowup", mod: false }],
  },
  {
    id: "volumeDown",
    group: "Player",
    label: "Volume down",
    defaults: [{ key: "arrowdown", mod: false }],
  },
  {
    id: "mute",
    group: "Player",
    label: "Mute",
    defaults: [{ key: "m", mod: false }],
  },
  {
    id: "fullscreen",
    group: "Player",
    label: "Fullscreen",
    defaults: [{ key: "f", mod: false }],
  },
  {
    id: "cycleCaptions",
    group: "Player",
    label: "Cycle subtitles",
    defaults: [{ key: "c", mod: false }],
  },
  {
    id: "miniPlayer",
    group: "Player",
    label: "Mini player",
    defaults: [{ key: "i", mod: false }],
  },
  {
    id: "nextEpisode",
    group: "Player",
    label: "Next episode",
    defaults: [{ key: "n", mod: false }],
  },
  {
    id: "previousEpisode",
    group: "Player",
    label: "Previous episode",
    defaults: [{ key: "p", mod: false }],
  },
] as const satisfies ReadonlyArray<{
  id: string
  group: "General" | "Player"
  label: string
  defaults: ReadonlyArray<KeyBinding>
}>

export type ShortcutActionId = (typeof shortcutActions)[number]["id"]

export type ShortcutMap = Record<ShortcutActionId, ReadonlyArray<KeyBinding>>

export const resolveShortcuts = (overrides: ShortcutOverrides): ShortcutMap =>
  Object.fromEntries(
    shortcutActions.map((action) => [
      action.id,
      overrides[action.id] ?? action.defaults,
    ])
  ) as ShortcutMap

// Shift is ignored so keys like "/" or "?" work on any keyboard layout;
// Alt is never part of a shortcut, so Alt combinations never match.
export const matchesBinding = (event: KeyboardEvent, binding: KeyBinding) =>
  !event.altKey &&
  event.key.toLowerCase() === binding.key &&
  (event.metaKey || event.ctrlKey) === binding.mod

export const matchesAction = (
  event: KeyboardEvent,
  shortcuts: ShortcutMap,
  action: ShortcutActionId
) => shortcuts[action].some((binding) => matchesBinding(event, binding))

const modifierKeys = new Set(["meta", "control", "shift", "alt"])

// The binding a key press would record, or null while only a modifier is held.
export const bindingFromEvent = (event: KeyboardEvent): KeyBinding | null => {
  const key = event.key.toLowerCase()
  if (modifierKeys.has(key) || event.altKey) return null
  return { key, mod: event.metaKey || event.ctrlKey }
}

export const sameBinding = (left: KeyBinding, right: KeyBinding) =>
  left.key === right.key && left.mod === right.mod

const keyNames: Record<string, string> = {
  " ": "Space",
  arrowleft: "←",
  arrowright: "→",
  arrowup: "↑",
  arrowdown: "↓",
  escape: "Esc",
  enter: "Enter",
  backspace: "⌫",
  tab: "Tab",
}

const isMac =
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad/i.test(navigator.platform)

export const formatBinding = (binding: KeyBinding) => {
  const key = keyNames[binding.key] ?? binding.key.toUpperCase()
  return binding.mod ? `${isMac ? "⌘" : "Ctrl+"}${key}` : key
}

// Typing in a field must never trigger single-key shortcuts.
export const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLInputElement) return target.type !== "range"
  return (
    target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
  )
}
