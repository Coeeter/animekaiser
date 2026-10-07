import { ShortcutOverrides } from "@animekaiser/domain"
import { Atom } from "@effect-atom/atom-react"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { matchesAction, resolveShortcuts } from "./shortcuts"

const storageKey = "kaiser-shortcuts"

const decodeStored = Schema.decodeUnknownOption(
  Schema.parseJson(ShortcutOverrides)
)

const readStored = (): ShortcutOverrides => {
  if (typeof window === "undefined") return {}
  try {
    return decodeStored(window.localStorage.getItem(storageKey)).pipe(
      Option.getOrElse(() => ({}))
    )
  } catch {
    return {}
  }
}

export const writeStoredShortcutOverrides = (overrides: ShortcutOverrides) => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(overrides))
  } catch {}
}

export const shortcutOverridesAtom = Atom.make<ShortcutOverrides>(
  readStored()
).pipe(Atom.keepAlive)

export const setShortcutOverridesAtom = Atom.writable<
  ShortcutOverrides,
  ShortcutOverrides
>(
  (get) => get(shortcutOverridesAtom),
  (ctx, overrides) => {
    ctx.set(shortcutOverridesAtom, overrides)
    writeStoredShortcutOverrides(overrides)
  }
)

export const shortcutsAtom = Atom.make((get) =>
  resolveShortcuts(get(shortcutOverridesAtom))
)

export const toggleSidebarShortcutAtom = Atom.make((get) => {
  const shortcuts = get(shortcutsAtom)
  return (event: KeyboardEvent) =>
    matchesAction(event, shortcuts, "toggleSidebar")
})
