import type { AnimeItem } from "@animekaiser/domain"
import * as Atom from "effect/reactivity/Atom"
import * as Schema from "effect/Schema"
import { localStorageRuntime } from "../../../services/storage"
import { shortcutsAtom } from "../../shortcuts/atoms"
import { isTypingTarget, matchesAction } from "../../shortcuts/shortcuts"

export const searchOpenAtom = Atom.make(false)

// While set, search results are picked for the caller (for example a room
// shortlist) instead of opening the series page.
export type SearchPick = {
  readonly title: string
  readonly onPick: (anime: AnimeItem) => void
}

export const searchPickAtom = Atom.make<SearchPick | null>(null).pipe(
  Atom.keepAlive
)

const recentSearchesKey = "animekaiser:recent-searches"
const recentSearchesLimit = 6

export const recentSearchesAtom = Atom.kvs({
  runtime: localStorageRuntime,
  key: recentSearchesKey,
  schema: Schema.Array(Schema.String),
  defaultValue: (): ReadonlyArray<string> => [],
}).pipe(Atom.keepAlive)

export const rememberSearchAtom = Atom.writable<ReadonlyArray<string>, string>(
  (get) => get(recentSearchesAtom),
  (ctx, query) => {
    const trimmed = query.trim()
    if (trimmed.length === 0) return

    const existing = ctx
      .get(recentSearchesAtom)
      .filter((value) => value.toLowerCase() !== trimmed.toLowerCase())
    const next = [trimmed, ...existing].slice(0, recentSearchesLimit)

    ctx.set(recentSearchesAtom, next)
  }
)

export const clearRecentSearchesAtom = Atom.writable<
  ReadonlyArray<string>,
  void
>(
  (get) => get(recentSearchesAtom),
  (ctx) => {
    ctx.set(recentSearchesAtom, [])
  }
)

export const searchShortcutAtom = Atom.make((get) => {
  const shortcuts = get(shortcutsAtom)
  const keydown = (event: KeyboardEvent) => {
    if (!matchesAction(event, shortcuts, "search")) return
    // Single-key bindings like "/" must not fire while typing.
    const single = !(event.metaKey || event.ctrlKey)
    if (single && isTypingTarget(event.target)) return

    event.preventDefault()
    get.set(searchOpenAtom, true)
  }

  window.addEventListener("keydown", keydown)
  get.addFinalizer(() => window.removeEventListener("keydown", keydown))
})

export const suggestedGenres = [
  "Action",
  "Romance",
  "Comedy",
  "Fantasy",
  "Slice of Life",
  "Thriller",
]
