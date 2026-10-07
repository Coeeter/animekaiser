import type { StreamEpisode } from "@animekaiser/domain"
import { useAtomValue } from "@effect-atom/atom-react"
import { useEffect, useRef } from "react"
import { shortcutsAtom } from "../../../shortcuts/atoms"
import {
  isTypingTarget,
  matchesAction,
  type ShortcutActionId,
} from "../../../shortcuts/shortcuts"

export function usePlayerKeyboard({
  togglePlayback,
  seekBy,
  adjustVolume,
  toggleMute,
  toggleFullscreen,
  cycleCaptions,
  toggleMiniPlayer,
  navigateToEpisode,
  revealControls,
  goNext,
  previousEpisode,
}: {
  togglePlayback: () => void
  seekBy: (seconds: number) => void
  adjustVolume: (delta: number) => void
  toggleMute: () => void
  toggleFullscreen: () => void
  cycleCaptions: () => void
  toggleMiniPlayer: () => void
  navigateToEpisode: (episode: StreamEpisode | null) => void
  revealControls: () => void
  goNext: () => void
  previousEpisode: StreamEpisode | null
}) {
  const shortcuts = useAtomValue(shortcutsAtom)
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  const handlersRef = useRef({
    togglePlayback,
    seekBy,
    adjustVolume,
    toggleMute,
    toggleFullscreen,
    cycleCaptions,
    toggleMiniPlayer,
    navigateToEpisode,
    revealControls,
    goNext,
    previousEpisode,
  })

  handlersRef.current = {
    togglePlayback,
    seekBy,
    adjustVolume,
    toggleMute,
    toggleFullscreen,
    cycleCaptions,
    toggleMiniPlayer,
    navigateToEpisode,
    revealControls,
    goNext,
    previousEpisode,
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return

      const h = handlersRef.current
      const actions: ReadonlyArray<[ShortcutActionId, () => void, boolean]> = [
        ["playPause", h.togglePlayback, true],
        ["seekBack", () => h.seekBy(-10), true],
        ["seekForward", () => h.seekBy(10), true],
        ["volumeUp", () => h.adjustVolume(0.05), true],
        ["volumeDown", () => h.adjustVolume(-0.05), true],
        ["mute", h.toggleMute, true],
        ["fullscreen", h.toggleFullscreen, true],
        ["cycleCaptions", h.cycleCaptions, true],
        ["miniPlayer", h.toggleMiniPlayer, false],
        ["nextEpisode", h.goNext, false],
        [
          "previousEpisode",
          () => h.navigateToEpisode(h.previousEpisode),
          false,
        ],
      ]
      const match = actions.find(([action]) =>
        matchesAction(event, shortcutsRef.current, action)
      )
      if (!match) return

      event.preventDefault()
      const [, run, reveal] = match
      run()
      if (reveal) h.revealControls()
    }
    window.addEventListener("keydown", keydown)
    return () => window.removeEventListener("keydown", keydown)
  }, [])
}
