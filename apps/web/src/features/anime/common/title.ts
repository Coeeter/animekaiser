import type { AnimeTitle } from "@animekaiser/domain"
import { AnimeTitlePreference } from "@animekaiser/domain"
import * as Atom from "effect/reactivity/Atom"
import { localStorageRuntime } from "../../../services/storage"

export type { AnimeTitlePreference }

export const animeTitlePreferenceAtom = Atom.kvs({
  runtime: localStorageRuntime,
  key: "anime-title-preference",
  schema: AnimeTitlePreference,
  defaultValue: (): AnimeTitlePreference => "romaji",
}).pipe(Atom.keepAlive)

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
