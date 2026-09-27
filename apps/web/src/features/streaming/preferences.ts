import { StreamProviderId } from "@animekaiser/domain"
import { Atom } from "@effect-atom/atom-react"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

export const VideoFit = Schema.Literal("contain", "cover", "fill")
export type VideoFit = typeof VideoFit.Type

export const PlayerViewMode = Schema.Literal("theater", "immersive")
export type PlayerViewMode = typeof PlayerViewMode.Type

export const subtitlePreferenceDefaults = {
  subtitleSizePercent: 100,
  subtitleColor: "#ffffff",
  subtitleBackgroundColor: "#000000",
  subtitleBackgroundOpacityPercent: 75,
  subtitleShadow: true,
} as const

export const PlayerPreferences = Schema.Struct({
  autoplay: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  autoNext: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  autoSkipIntro: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  autoSkipOutro: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  syncLibraryOnFinish: Schema.optionalWith(Schema.Boolean, {
    default: () => true,
  }),
  audioEnhancementPercent: Schema.optionalWith(Schema.Number, {
    default: () => 100,
  }),
  subtitleSizePercent: Schema.optionalWith(Schema.Number, {
    default: () => subtitlePreferenceDefaults.subtitleSizePercent,
  }),
  subtitleColor: Schema.optionalWith(Schema.String, {
    default: () => subtitlePreferenceDefaults.subtitleColor,
  }),
  subtitleBackgroundColor: Schema.optionalWith(Schema.String, {
    default: () => subtitlePreferenceDefaults.subtitleBackgroundColor,
  }),
  subtitleBackgroundOpacityPercent: Schema.optionalWith(Schema.Number, {
    default: () => subtitlePreferenceDefaults.subtitleBackgroundOpacityPercent,
  }),
  subtitleShadow: Schema.optionalWith(Schema.Boolean, {
    default: () => subtitlePreferenceDefaults.subtitleShadow,
  }),
  videoFit: Schema.optionalWith(VideoFit, { default: () => "contain" }),
  viewMode: Schema.optionalWith(PlayerViewMode, { default: () => "theater" }),
  preferredAudio: Schema.optionalWith(Schema.Literal("sub", "dub"), {
    default: () => "sub",
  }),
  preferredProvider: Schema.optionalWith(Schema.NullOr(Schema.String), {
    default: () => null,
  }),
  subtitleLanguage: Schema.optionalWith(Schema.NullOr(Schema.String), {
    default: () => null,
  }),
  blurUnwatched: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  autoLandscape: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type PlayerPreferences = typeof PlayerPreferences.Type

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
