import type { UserPreferences } from "@animekaiser/domain"
import { Atom, Result } from "@effect-atom/atom-react"
import * as Effect from "effect/Effect"
import { KaiserRpcClient } from "../../services/api-clients"
import {
  animeTitlePreferenceAtom,
  writeStoredTitlePreference,
} from "../anime/common/title"
import { sessionAtom } from "../auth/atoms"
import {
  shortcutOverridesAtom,
  writeStoredShortcutOverrides,
} from "../shortcuts/atoms"
import {
  playerPreferencesAtom,
  writeStoredPlayerPreferences,
} from "../streaming/preferences"

const savedPreferencesAtom = KaiserRpcClient.query("GetPreferences", void 0)

// A newer change interrupts a pending upload, so dragging a slider sends one
// request once it settles.
const uploadPreferencesAtom = KaiserRpcClient.runtime
  .fn((preferences: UserPreferences) =>
    Effect.sleep("700 millis").pipe(
      Effect.zipRight(
        Effect.flatMap(KaiserRpcClient, (client) =>
          client("UpdatePreferences", { preferences })
        )
      ),
      Effect.ignore
    )
  )
  .pipe(Atom.keepAlive)

// The user whose saved preferences this browser has already taken on, and
// the preferences last known to match the server.
const hydratedForAtom = Atom.make<string | null>(null).pipe(Atom.keepAlive)
const lastSyncedAtom = Atom.make<string | null>(null).pipe(Atom.keepAlive)

// Signed in, the account's saved preferences replace this browser's once;
// an account with none saved takes this browser's. After that, every local
// change is uploaded. Signed out, preferences stay in this browser only.
export const preferencesSyncAtom = Atom.make((get) => {
  const session = get(sessionAtom)
  const userId = Result.isSuccess(session) ? session.value?.user.id : undefined
  if (!userId) return

  const local: UserPreferences = {
    titleLanguage: get(animeTitlePreferenceAtom),
    player: get(playerPreferencesAtom),
    shortcuts: get(shortcutOverridesAtom),
  }

  if (get(hydratedForAtom) !== userId) {
    const saved = get(savedPreferencesAtom)
    if (!Result.isSuccess(saved)) return
    if (saved.value === null) {
      get.set(uploadPreferencesAtom, local)
      get.set(lastSyncedAtom, JSON.stringify(local))
    } else {
      get.set(animeTitlePreferenceAtom, saved.value.titleLanguage)
      writeStoredTitlePreference(saved.value.titleLanguage)
      get.set(playerPreferencesAtom, saved.value.player)
      writeStoredPlayerPreferences(saved.value.player)
      get.set(shortcutOverridesAtom, saved.value.shortcuts)
      writeStoredShortcutOverrides(saved.value.shortcuts)
      get.set(lastSyncedAtom, JSON.stringify(saved.value))
    }
    get.set(hydratedForAtom, userId)
    return
  }

  const serialized = JSON.stringify(local)
  if (serialized === get(lastSyncedAtom)) return
  get.set(lastSyncedAtom, serialized)
  get.set(uploadPreferencesAtom, local)
})
