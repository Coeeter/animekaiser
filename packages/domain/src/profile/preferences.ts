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

// Every field has a default so preferences saved by an older client still
// decode after new settings are added.
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

export const AnimeTitlePreference = Schema.Literal("english", "romaji")
export type AnimeTitlePreference = typeof AnimeTitlePreference.Type

// `key` is KeyboardEvent.key lower-cased; `mod` is ⌘ on macOS, Ctrl elsewhere.
export const KeyBinding = Schema.Struct({
  key: Schema.String,
  mod: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type KeyBinding = typeof KeyBinding.Type

// Only shortcuts the user changed are stored, keyed by action id, so new
// defaults still reach everyone else.
export const ShortcutOverrides = Schema.Record({
  key: Schema.String,
  value: Schema.Array(KeyBinding),
})
export type ShortcutOverrides = typeof ShortcutOverrides.Type

export const UserPreferences = Schema.Struct({
  titleLanguage: Schema.optionalWith(AnimeTitlePreference, {
    default: () => "romaji",
  }),
  player: Schema.optionalWith(PlayerPreferences, {
    default: () => Schema.decodeSync(PlayerPreferences)({}),
  }),
  shortcuts: Schema.optionalWith(ShortcutOverrides, { default: () => ({}) }),
})
export type UserPreferences = typeof UserPreferences.Type
