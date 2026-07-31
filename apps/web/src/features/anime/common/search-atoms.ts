import { Atom } from "@effect-atom/atom-react"

export const searchOpenAtom = Atom.make(false)

const recentSearchesKey = "animekaiser:recent-searches"
const recentSearchesLimit = 6

const readRecentSearches = (): ReadonlyArray<string> => {
  try {
    const raw = window.localStorage.getItem(recentSearchesKey)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((value): value is string => typeof value === "string")
      .slice(0, recentSearchesLimit)
  } catch {
    return []
  }
}

export const recentSearchesAtom = Atom.make<ReadonlyArray<string>>(
  typeof window === "undefined" ? [] : readRecentSearches()
).pipe(Atom.keepAlive)

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

    try {
      window.localStorage.setItem(recentSearchesKey, JSON.stringify(next))
    } catch {}
  }
)

export const clearRecentSearchesAtom = Atom.writable<
  ReadonlyArray<string>,
  void
>(
  (get) => get(recentSearchesAtom),
  (ctx) => {
    ctx.set(recentSearchesAtom, [])

    try {
      window.localStorage.removeItem(recentSearchesKey)
    } catch {}
  }
)

export const searchShortcutAtom = Atom.make((get) => {
  const keydown = (event: KeyboardEvent) => {
    const target = event.target
    const editing =
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

    const commandK =
      event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)
    const slash =
      event.key === "/" &&
      !editing &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey

    if (!commandK && !slash) return

    event.preventDefault()
    get.set(searchOpenAtom, true)
  }

  window.addEventListener("keydown", keydown)
  get.addFinalizer(() => window.removeEventListener("keydown", keydown))
})
