import { ShortcutOverrides } from "@animekaiser/domain"
import * as Atom from "effect/reactivity/Atom"
import { localStorageRuntime } from "../../services/storage"
import { matchesAction, resolveShortcuts } from "./shortcuts"

export const shortcutOverridesAtom = Atom.kvs({
  runtime: localStorageRuntime,
  key: "kaiser-shortcuts",
  schema: ShortcutOverrides,
  defaultValue: (): ShortcutOverrides => ({}),
}).pipe(Atom.keepAlive)

export const shortcutsAtom = Atom.make((get) =>
  resolveShortcuts(get(shortcutOverridesAtom))
)

export const toggleSidebarShortcutAtom = Atom.make((get) => {
  const shortcuts = get(shortcutsAtom)
  return (event: KeyboardEvent) =>
    matchesAction(event, shortcuts, "toggleSidebar")
})
