import { Atom } from "@effect-atom/atom-react"
import type { QualityLevel } from "../player-format"

export type PlayerUiState = {
  settingsOpen: boolean
  episodesOpen: boolean
  serversOpen: boolean
}

export const playerUiAtom = Atom.make<PlayerUiState>({
  settingsOpen: false,
  episodesOpen: false,
  serversOpen: false,
}).pipe(Atom.keepAlive)

export const updatePlayerUiAtom = Atom.writable<
  PlayerUiState,
  Partial<PlayerUiState>
>(
  (get) => get(playerUiAtom),
  (ctx, patch) => {
    ctx.set(playerUiAtom, { ...ctx.get(playerUiAtom), ...patch })
  }
)

export const playerCaptionAtom = Atom.make("off").pipe(Atom.keepAlive)

export const playerQualityAtom = Atom.make("-1").pipe(Atom.keepAlive)

export const playerQualityLevelsAtom = Atom.make<Array<QualityLevel>>([]).pipe(
  Atom.keepAlive
)

export const playerSpeedAtom = Atom.make("1").pipe(Atom.keepAlive)
