import { Atom } from "@effect-atom/atom-react"
import type { AnimeTitle } from "@workspace/domain"

export type AnimeTitlePreference = "english" | "romaji"

export const animeTitlePreferenceAtom = Atom.make<AnimeTitlePreference>(
  "romaji"
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
