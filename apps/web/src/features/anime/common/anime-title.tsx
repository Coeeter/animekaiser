import type { AnimeTitle as AnimeTitleValue } from "@animekaiser/domain"
import { useAtomValue } from "@effect-atom/atom-react"
import type { ReactNode } from "react"
import {
  animeTitlePreferenceAtom,
  getAnimeSubtitle,
  getAnimeTitle,
} from "./title"

export function AnimeTitle({ title }: { title: AnimeTitleValue }) {
  const preference = useAtomValue(animeTitlePreferenceAtom)
  return getAnimeTitle(title, preference)
}

export function AnimeSubtitle({
  title,
  children,
}: {
  title: AnimeTitleValue
  children: (subtitle: string) => ReactNode
}) {
  const preference = useAtomValue(animeTitlePreferenceAtom)
  const subtitle = getAnimeSubtitle(title, preference)
  return subtitle ? children(subtitle) : null
}
