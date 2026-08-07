import { useEffect, useRef, useState } from "react"

export function useControlsVisibility({
  playing,
  settingsOpen,
  episodesOpen,
  serversOpen,
}: {
  playing: boolean
  settingsOpen: boolean
  episodesOpen: boolean
  serversOpen: boolean
}) {
  const [controlsVisible, setControlsVisible] = useState(true)
  const controlsVisibleRef = useRef(controlsVisible)
  const timeoutRef = useRef<number | null>(null)

  controlsVisibleRef.current = controlsVisible

  const clearTimeout = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const hideControls = () => {
    clearTimeout()
    setControlsVisible(false)
  }

  const revealControls = () => {
    clearTimeout()
    setControlsVisible(true)

    if (!playing || settingsOpen || episodesOpen || serversOpen) return

    timeoutRef.current = window.setTimeout(() => {
      setControlsVisible(false)
    }, 2500)
  }

  useEffect(() => {
    revealControls()
    return clearTimeout
  }, [playing, settingsOpen, episodesOpen])

  return {
    controlsVisible,
    controlsVisibleRef,
    hideControls,
    revealControls,
  } as const
}
