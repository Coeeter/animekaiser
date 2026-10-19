import {
  PlayerPreferences,
  PlayerViewMode,
  StreamProviderId,
  subtitlePreferenceDefaults,
  VideoFit,
} from "@animekaiser/domain"
import * as Option from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import * as Schema from "effect/Schema"
import { localStorageRuntime } from "../../services/storage"

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
  preferredQuality: null,
  subtitleLanguage: null,
  blurUnwatched: false,
  autoLandscape: false,
}

export const playerPreferencesAtom = Atom.kvs({
  runtime: localStorageRuntime,
  key: "kaiser-player-preferences",
  schema: PlayerPreferences,
  defaultValue: () => defaultPlayerPreferences,
}).pipe(Atom.keepAlive)

export const updatePlayerPreferencesAtom = Atom.writable<
  PlayerPreferences,
  Partial<PlayerPreferences>
>(
  (get) => get(playerPreferencesAtom),
  (ctx, patch) =>
    ctx.set(playerPreferencesAtom, {
      ...ctx.get(playerPreferencesAtom),
      ...patch,
    })
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
