import { Atom } from "@effect-atom/atom-react"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

export const PlayerPreferences = Schema.Struct({
  autoplay: Schema.Boolean,
  autoNext: Schema.Boolean,
  syncLibraryOnFinish: Schema.Boolean,
})
export type PlayerPreferences = typeof PlayerPreferences.Type

export const defaultPlayerPreferences: PlayerPreferences = {
  autoplay: false,
  autoNext: false,
  syncLibraryOnFinish: false,
}

export const playerPreferencesStorageKey = "kaiser-player-preferences"

export const playerPreferencesAtom = Atom.make<PlayerPreferences>(
  defaultPlayerPreferences
).pipe(Atom.keepAlive)

const StoredPlayerPreferences = Schema.parseJson(PlayerPreferences)
const decodeStoredPlayerPreferencesOption = Schema.decodeUnknownOption(
  StoredPlayerPreferences
)

export const readStoredPlayerPreferences = (value: string | null) =>
  value === null
    ? defaultPlayerPreferences
    : decodeStoredPlayerPreferencesOption(value).pipe(
        Option.getOrElse(() => defaultPlayerPreferences)
      )

export const writeStoredPlayerPreferences = (
  preferences: PlayerPreferences
) => {
  window.localStorage.setItem(
    playerPreferencesStorageKey,
    JSON.stringify(preferences)
  )
}
