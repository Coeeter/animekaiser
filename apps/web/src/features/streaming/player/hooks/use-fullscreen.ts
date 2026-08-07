import type { RefObject } from "react"
import { useEffect, useState } from "react"

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => void
}

type WebkitVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
  webkitExitFullscreen?: () => void
}

const isWebkitVideo = (video: HTMLVideoElement): video is WebkitVideo =>
  "webkitEnterFullscreen" in video

const isFullscreenElement = (): boolean =>
  Boolean(
    document.fullscreenElement ??
      (document as WebkitDocument).webkitFullscreenElement
  )

const enterFullscreen = (
  player: HTMLElement,
  video: HTMLVideoElement
): void => {
  if (
    isWebkitVideo(video) &&
    typeof video.webkitEnterFullscreen === "function"
  ) {
    video.webkitEnterFullscreen()
    return
  }

  void player.requestFullscreen()
}

const exitFullscreen = (video: HTMLVideoElement): void => {
  const webkitDoc = document as WebkitDocument

  if (isWebkitVideo(video) && webkitDoc.webkitFullscreenElement) {
    video.webkitExitFullscreen?.()
    return
  }

  if (document.fullscreenElement) {
    void document.exitFullscreen()
  }
}

export function useFullscreen({
  playerRef,
  videoRef,
}: {
  playerRef: RefObject<HTMLElement | null>
  videoRef: RefObject<HTMLVideoElement | null>
}) {
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setFullscreen(isFullscreenElement())

    document.addEventListener("fullscreenchange", onChange)
    document.addEventListener("webkitfullscreenchange", onChange)

    return () => {
      document.removeEventListener("fullscreenchange", onChange)
      document.removeEventListener("webkitfullscreenchange", onChange)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onBegin = () => setFullscreen(true)
    const onEnd = () => setFullscreen(false)

    video.addEventListener("webkitbeginfullscreen", onBegin)
    video.addEventListener("webkitendfullscreen", onEnd)

    return () => {
      video.removeEventListener("webkitbeginfullscreen", onBegin)
      video.removeEventListener("webkitendfullscreen", onEnd)
    }
  }, [videoRef])

  const toggleFullscreen = () => {
    const player = playerRef.current
    const video = videoRef.current
    if (!player || !video) return

    if (fullscreen) {
      exitFullscreen(video)
      return
    }

    enterFullscreen(player, video)
  }

  return { fullscreen, toggleFullscreen } as const
}
