import type { StreamEpisode } from "@animekaiser/domain"
import { useEffect, useRef } from "react"

const isEditingKeyboardTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLInputElement) return target.type !== "range"
  return (
    target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
  )
}

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
  nextEpisode,
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
  nextEpisode: StreamEpisode | null
  previousEpisode: StreamEpisode | null
}) {
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
    nextEpisode,
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
    nextEpisode,
    previousEpisode,
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        isEditingKeyboardTarget(event.target) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return
      }

      const h = handlersRef.current

      if (event.key === " " || event.key.toLowerCase() === "k") {
        event.preventDefault()
        h.togglePlayback()
        h.revealControls()
        return
      }
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "j") {
        event.preventDefault()
        h.seekBy(-10)
        h.revealControls()
        return
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "l") {
        event.preventDefault()
        h.seekBy(10)
        h.revealControls()
        return
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        h.adjustVolume(0.05)
        h.revealControls()
        return
      }
      if (event.key === "ArrowDown") {
        event.preventDefault()
        h.adjustVolume(-0.05)
        h.revealControls()
        return
      }
      if (event.key.toLowerCase() === "m") {
        event.preventDefault()
        h.toggleMute()
        h.revealControls()
        return
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault()
        h.toggleFullscreen()
        h.revealControls()
        return
      }
      if (event.key.toLowerCase() === "c") {
        event.preventDefault()
        h.cycleCaptions()
        h.revealControls()
        return
      }
      if (event.key.toLowerCase() === "i") {
        event.preventDefault()
        h.toggleMiniPlayer()
        return
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault()
        h.navigateToEpisode(h.nextEpisode)
        return
      }
      if (event.key.toLowerCase() === "p") {
        event.preventDefault()
        h.navigateToEpisode(h.previousEpisode)
      }
    }
    window.addEventListener("keydown", keydown)
    return () => window.removeEventListener("keydown", keydown)
  }, [])
}
