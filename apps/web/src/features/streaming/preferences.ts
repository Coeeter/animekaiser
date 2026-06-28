import { Atom } from "@effect-atom/atom-react"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

export const VideoFit = Schema.Literal("contain", "cover", "fill")
export type VideoFit = typeof VideoFit.Type

export const PlayerPreferences = Schema.Struct({
  autoplay: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  autoNext: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  autoSkipIntro: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  autoSkipOutro: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  syncLibraryOnFinish: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),
  videoFit: Schema.optionalWith(VideoFit, { default: () => "contain" }),
})
export type PlayerPreferences = typeof PlayerPreferences.Type

export const defaultPlayerPreferences: PlayerPreferences = {
  autoplay: false,
  autoNext: false,
  autoSkipIntro: false,
  autoSkipOutro: false,
  syncLibraryOnFinish: false,
  videoFit: "contain",
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
