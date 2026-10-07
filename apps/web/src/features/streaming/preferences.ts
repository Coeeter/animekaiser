import {
  PlayerPreferences,
  PlayerViewMode,
  StreamProviderId,
  subtitlePreferenceDefaults,
  VideoFit,
} from "@animekaiser/domain"
import { Atom } from "@effect-atom/atom-react"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

export {
  PlayerPreferences,
  PlayerViewMode,
  subtitlePreferenceDefaults,
  VideoFit,
}

export const defaultPlayerPreferences: PlayerPreferences = {
  autoplay: false,
  autoNext: false,
  autoSkipIntro: false,
  autoSkipOutro: false,
  syncLibraryOnFinish: true,
  audioEnhancementPercent: 100,
  ...subtitlePreferenceDefaults,
  videoFit: "contain",
  viewMode: "theater",
  preferredAudio: "sub",
  preferredProvider: null,
  subtitleLanguage: null,
  blurUnwatched: false,
  autoLandscape: false,
}

export const playerPreferencesStorageKey = "kaiser-player-preferences"

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

export const playerPreferencesAtom = Atom.make<PlayerPreferences>(
  typeof window === "undefined"
    ? defaultPlayerPreferences
    : readStoredPlayerPreferences(
        window.localStorage.getItem(playerPreferencesStorageKey)
      )
).pipe(Atom.keepAlive)

export const writeStoredPlayerPreferences = (
  preferences: PlayerPreferences
) => {
  if (typeof window === "undefined") return

  window.localStorage.setItem(
    playerPreferencesStorageKey,
    JSON.stringify(preferences)
  )
}

export const updatePlayerPreferencesAtom = Atom.writable<
  PlayerPreferences,
  Partial<PlayerPreferences>
>(
  (get) => get(playerPreferencesAtom),
  (ctx, patch) => {
    const next = { ...ctx.get(playerPreferencesAtom), ...patch }

    writeStoredPlayerPreferences(next)
    ctx.set(playerPreferencesAtom, next)
  }
)

export const spoilerBlurAtom = Atom.make(
  (get) => get(playerPreferencesAtom).blurUnwatched
)

const decodeProviderOption = Schema.decodeUnknownOption(StreamProviderId)

export const preferredProviderAtom = Atom.make((get) =>
  Option.getOrUndefined(
    decodeProviderOption(get(playerPreferencesAtom).preferredProvider)
  )
)
