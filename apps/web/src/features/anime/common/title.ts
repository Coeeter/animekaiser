import type { AnimeTitle } from "@animekaiser/domain"
import { Atom } from "@effect-atom/atom-react"

export type AnimeTitlePreference = "english" | "romaji"

const initialTitlePreference = (): AnimeTitlePreference => {
  if (typeof window === "undefined") return "romaji"
  return window.localStorage.getItem("anime-title-preference") === "english"
    ? "english"
    : "romaji"
}

export const animeTitlePreferenceAtom = Atom.make<AnimeTitlePreference>(
  initialTitlePreference()
).pipe(Atom.keepAlive)

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
