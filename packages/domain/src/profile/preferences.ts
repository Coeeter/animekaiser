import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

export const VideoFit = Schema.Literals(["contain", "cover", "fill"])
export type VideoFit = typeof VideoFit.Type

export const PlayerViewMode = Schema.Literals(["theater", "immersive"])
export type PlayerViewMode = typeof PlayerViewMode.Type

export const PreferredQuality = Schema.Literals([360, 480, 720, 1080])
export type PreferredQuality = typeof PreferredQuality.Type

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
  autoplay: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false))
  ),
  autoNext: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false))
  ),
  autoSkipIntro: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false))
  ),
  autoSkipOutro: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false))
  ),
  syncLibraryOnFinish: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(true))
  ),
  audioEnhancementPercent: Schema.Number.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(100))
  ),
  subtitleSizePercent: Schema.Number.pipe(
    Schema.withDecodingDefaultType(
      Effect.succeed(subtitlePreferenceDefaults.subtitleSizePercent)
    )
  ),
  subtitleColor: Schema.String.pipe(
    Schema.withDecodingDefaultType(
      Effect.succeed(subtitlePreferenceDefaults.subtitleColor)
    )
  ),
  subtitleBackgroundColor: Schema.String.pipe(
    Schema.withDecodingDefaultType(
      Effect.succeed(subtitlePreferenceDefaults.subtitleBackgroundColor)
    )
  ),
  subtitleBackgroundOpacityPercent: Schema.Number.pipe(
    Schema.withDecodingDefaultType(
      Effect.succeed(
        subtitlePreferenceDefaults.subtitleBackgroundOpacityPercent
      )
    )
  ),
  subtitleShadow: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(
      Effect.succeed(subtitlePreferenceDefaults.subtitleShadow)
    )
  ),
  videoFit: VideoFit.pipe(
    Schema.withDecodingDefaultType(Effect.succeed("contain"))
  ),
  viewMode: PlayerViewMode.pipe(
    Schema.withDecodingDefaultType(Effect.succeed("theater"))
  ),
  preferredAudio: Schema.Literals(["sub", "dub"]).pipe(
    Schema.withDecodingDefaultType(Effect.succeed("sub"))
  ),
  preferredProvider: Schema.NullOr(Schema.String).pipe(
    Schema.withDecodingDefaultType(Effect.succeed(null))
  ),
  preferredQuality: Schema.NullOr(PreferredQuality).pipe(
    Schema.withDecodingDefaultType(Effect.succeed(null))
  ),
  subtitleLanguage: Schema.NullOr(Schema.String).pipe(
    Schema.withDecodingDefaultType(Effect.succeed(null))
  ),
  blurUnwatched: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false))
  ),
  autoLandscape: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false))
  ),
})
export type PlayerPreferences = typeof PlayerPreferences.Type

export const AnimeTitlePreference = Schema.Literals(["english", "romaji"])
export type AnimeTitlePreference = typeof AnimeTitlePreference.Type

// `key` is KeyboardEvent.key lower-cased; `mod` is ⌘ on macOS, Ctrl elsewhere.
export const KeyBinding = Schema.Struct({
  key: Schema.String,
  mod: Schema.Boolean.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(false))
  ),
})
export type KeyBinding = typeof KeyBinding.Type

// Only shortcuts the user changed are stored, keyed by action id, so new
// defaults still reach everyone else.
export const ShortcutOverrides = Schema.Record(
  Schema.String,
  Schema.Array(KeyBinding)
)
export type ShortcutOverrides = typeof ShortcutOverrides.Type

export const UserPreferences = Schema.Struct({
  titleLanguage: AnimeTitlePreference.pipe(
    Schema.withDecodingDefaultType(Effect.succeed("romaji"))
  ),
  player: PlayerPreferences.pipe(
    Schema.withDecodingDefault(Effect.succeed({}))
  ),
  shortcuts: ShortcutOverrides.pipe(
    Schema.withDecodingDefaultType(Effect.succeed({}))
  ),
})
export type UserPreferences = typeof UserPreferences.Type
