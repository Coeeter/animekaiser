import type { AnimeTitle, AnimeTitlePreference } from "@animekaiser/domain"
import { Atom } from "@effect-atom/atom-react"

export type { AnimeTitlePreference }

const titlePreferenceKey = "anime-title-preference"

const initialTitlePreference = (): AnimeTitlePreference => {
  if (typeof window === "undefined") return "romaji"
  return window.localStorage.getItem(titlePreferenceKey) === "english"
    ? "english"
    : "romaji"
}

export const animeTitlePreferenceAtom = Atom.make<AnimeTitlePreference>(
  initialTitlePreference()
).pipe(Atom.keepAlive)

export const writeStoredTitlePreference = (
  preference: AnimeTitlePreference
) => {
  try {
    window.localStorage.setItem(titlePreferenceKey, preference)
  } catch {}
}

export const setAnimeTitlePreferenceAtom = Atom.writable<
  AnimeTitlePreference,
  AnimeTitlePreference
>(
  (get) => get(animeTitlePreferenceAtom),
  (ctx, preference) => {
    ctx.set(animeTitlePreferenceAtom, preference)
    writeStoredTitlePreference(preference)
  }
)

export const getAnimeTitle = (
  title: AnimeTitle,
  preference: AnimeTitlePreference
) => (preference === "english" ? (title.english ?? title.romaji) : title.romaji)

export const getAnimeSubtitle = (
  title: AnimeTitle,
  preference: AnimeTitlePreference
) => {
  const subtitle = preference === "english" ? title.romaji : title.english
  return subtitle && subtitle !== getAnimeTitle(title, preference)
    ? subtitle
    : null
}
