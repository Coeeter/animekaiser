import type { RefObject } from "react"
import { useEffect, useRef } from "react"
import type { SubtitleCue } from "../../subtitles"

type WebkitVideo = HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }

// iPhone fullscreen hands the video to the native player, which hides the
// subtitle overlay and only renders the element's own text tracks. Text tracks
// cannot be removed once added, so one track is reused and its cues swapped.
export function useNativeSubtitles(
  videoRef: RefObject<HTMLVideoElement | null>,
  cues: ReadonlyArray<SubtitleCue>
) {
  const trackRef = useRef<TextTrack | null>(null)

  useEffect(() => {
    const video: WebkitVideo | null = videoRef.current
    if (!video || !("webkitEnterFullscreen" in video)) return

    trackRef.current ??= video.addTextTrack("subtitles", "Subtitles")
    const track = trackRef.current
    const show = () => {
      track.mode = "showing"
    }
    const hide = () => {
      track.mode = "hidden"
    }

    if (video.webkitDisplayingFullscreen) show()
    else hide()

    const added = cues.map(
      (cue) =>
        new VTTCue(cue.start, cue.end, cue.html.replaceAll("<br />", "\n"))
    )
    for (const cue of added) track.addCue(cue)

    video.addEventListener("webkitbeginfullscreen", show)
    video.addEventListener("webkitendfullscreen", hide)

    return () => {
      video.removeEventListener("webkitbeginfullscreen", show)
      video.removeEventListener("webkitendfullscreen", hide)
      for (const cue of added) track.removeCue(cue)
    }
  }, [videoRef, cues])
}
