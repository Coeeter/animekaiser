import { Atom } from "@effect-atom/atom-react"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

export const VideoFit = Schema.Literal("contain", "cover", "fill")
export type VideoFit = typeof VideoFit.Type

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
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    playerPreferencesStorageKey,
    JSON.stringify(preferences)
  )
}

export class PlayerPreferencesService extends Effect.Service<PlayerPreferencesService>()(
  "@workspace/web/PlayerPreferencesService",
  {
    accessors: true,
    effect: Effect.succeed({
      read: () =>
        Effect.sync(() => {
          if (typeof window === "undefined") return defaultPlayerPreferences
          return readStoredPlayerPreferences(
            window.localStorage.getItem(playerPreferencesStorageKey)
          )
        }),

      write: (preferences: PlayerPreferences) =>
        Effect.sync(() => writeStoredPlayerPreferences(preferences)),

      update: (current: PlayerPreferences, patch: Partial<PlayerPreferences>) =>
        Effect.gen(function* () {
          const next = { ...current, ...patch }
          yield* Effect.sync(() => writeStoredPlayerPreferences(next))
          return next
        }),
    }),
  }
) {}

const runPlayerPreferences = <T>(
  effect: Effect.Effect<T, never, PlayerPreferencesService>
) =>
  Effect.runSync(effect.pipe(Effect.provide(PlayerPreferencesService.Default)))

export const updatePlayerPreferencesAtom = Atom.writable<
  PlayerPreferences,
  Partial<PlayerPreferences>
>(
  (get) => get(playerPreferencesAtom),
  (ctx, patch) => {
    const next = runPlayerPreferences(
      PlayerPreferencesService.update(ctx.get(playerPreferencesAtom), patch)
    )
    ctx.set(playerPreferencesAtom, next)
  }
)
