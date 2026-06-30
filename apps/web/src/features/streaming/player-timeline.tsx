import type { StreamPlayback } from "@workspace/domain"
import type { PointerEvent } from "react"
import { useEffect, useState } from "react"
import { formatTime } from "./player-format"
import { streamProxyUrl } from "./proxy"
import { parseTimestamp } from "./subtitles"

type ThumbnailRegion = {
  x: number
  y: number
  width: number
  height: number
}

type ThumbnailImage = {
  url: string
  region: ThumbnailRegion | null
}

type ThumbnailCue = {
  start: number
  end: number
  image: ThumbnailImage
}

type TimelineSegment = {
  key: string
  start: number
  end: number
  kind: "main" | "opening" | "ending"
}

type TimelineChapter = Omit<TimelineSegment, "key" | "kind"> & {
  kind: "opening" | "ending"
}

const parseThumbnailRegion = (value: string): ThumbnailRegion | null => {
  if (!value.startsWith("xywh=")) return null
  const parts = value.slice(5).split(",").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null
  }
  const x = parts[0] ?? 0
  const y = parts[1] ?? 0
  const width = parts[2] ?? 0
  const height = parts[3] ?? 0
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

const parseThumbnailImage = (
  value: string,
  referer: string
): ThumbnailImage => {
  const url = new URL(value)
  const region = parseThumbnailRegion(url.hash.slice(1))
  url.hash = ""
  return {
    url: streamProxyUrl(url.toString(), referer),
    region,
  }
}

const parseThumbnailVtt = (
  text: string,
  file: string,
  referer: string
): Array<ThumbnailCue> => {
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n")
  const cues: Array<ThumbnailCue> = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? ""
    if (!line.includes("-->")) continue

    const [start = "0", end = "0"] = line
      .split("-->")
      .map((value) => value.trim())
    let imageLine = ""
    for (let cueIndex = index + 1; cueIndex < lines.length; cueIndex += 1) {
      const candidate = lines[cueIndex]?.trim() ?? ""
      if (candidate.length === 0) break
      imageLine = candidate
      break
    }
    if (imageLine.length === 0) continue

    const imageUrl = new URL(imageLine, file).toString()
    cues.push({
      start: parseTimestamp(start),
      end: parseTimestamp(end),
      image: parseThumbnailImage(imageUrl, referer),
    })
  }

  return cues
}

const thumbnailForTime = (
  cues: ReadonlyArray<ThumbnailCue>,
  time: number | null
) => {
  if (time === null) return null
  return cues.find((cue) => time >= cue.start && time <= cue.end) ?? null
}

const clampTime = (value: number, duration: number) =>
  Math.min(Math.max(value, 0), duration)

const chapterTimelineSegments = ({
  intro,
  outro,
  duration,
}: {
  intro: StreamPlayback["intro"]
  outro: StreamPlayback["outro"]
  duration: number
}): Array<TimelineSegment> => {
  if (duration <= 0) {
    return [{ key: "main-0", start: 0, end: 1, kind: "main" }]
  }

  const chapters = [
    intro
      ? {
          start: clampTime(intro.start, duration),
          end: clampTime(intro.end, duration),
          kind: "opening" as const,
        }
      : null,
    outro
      ? {
          start: clampTime(outro.start, duration),
          end: clampTime(outro.end, duration),
          kind: "ending" as const,
        }
      : null,
  ]
    .filter((chapter): chapter is TimelineChapter => Boolean(chapter))
    .filter((chapter) => chapter.end > chapter.start)
    .sort((a, b) => a.start - b.start)

  const segments: Array<TimelineSegment> = []
  let cursor = 0

  for (const chapter of chapters) {
    const start = Math.max(chapter.start, cursor)
    const end = Math.max(chapter.end, start)
    if (start > cursor) {
      segments.push({
        key: `main-${segments.length}`,
        start: cursor,
        end: start,
        kind: "main",
      })
    }
    if (end > start) {
      segments.push({
        key: chapter.kind,
        start,
        end,
        kind: chapter.kind,
      })
      cursor = end
    }
  }

  if (cursor < duration) {
    segments.push({
      key: `main-${segments.length}`,
      start: cursor,
      end: duration,
      kind: "main",
    })
  }

  return segments.length > 0
    ? segments
    : [{ key: "main-0", start: 0, end: duration, kind: "main" }]
}

const timelineFillPercent = (segment: TimelineSegment, time: number) => {
  if (time <= segment.start) return 0
  if (time >= segment.end) return 100
  return ((time - segment.start) / (segment.end - segment.start)) * 100
}

const segmentAtTime = (
  segments: ReadonlyArray<TimelineSegment>,
  time: number | null
) => {
  if (time === null) return null
  return (
    segments.find((segment) => time >= segment.start && time <= segment.end) ??
    null
  )
}

const timelineSegmentLabel = (segment: TimelineSegment | null) => {
  if (segment?.kind === "opening") return "Opening"
  if (segment?.kind === "ending") return "Ending"
  return null
}

export function PlayerTimeline({
  playback,
  currentTime,
  duration,
  bufferedEnd,
  onSeek,
}: {
  playback: StreamPlayback
  currentTime: number
  duration: number
  bufferedEnd: number
  onSeek: (value: string) => void
}) {
  const [hoverPercent, setHoverPercent] = useState(0)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [thumbnailCues, setThumbnailCues] = useState<Array<ThumbnailCue>>([])
  const thumbnailTrack = playback.thumbnails.at(0) ?? null
  const thumbnailCue = thumbnailForTime(thumbnailCues, hoverTime)
  const timelineSegments = chapterTimelineSegments({
    intro: playback.intro,
    outro: playback.outro,
    duration,
  })
  const hoverSegment = segmentAtTime(timelineSegments, hoverTime)
  const hoverSegmentLabel = timelineSegmentLabel(hoverSegment)
  const hoverPreviewPercent = Math.min(
    Math.max(hoverPercent, thumbnailCue ? 8 : 4),
    thumbnailCue ? 92 : 96
  )

  useEffect(() => {
    setHoverTime(null)
    setThumbnailCues([])
  }, [playback.episode.id, playback.provider, playback.audio])

  useEffect(() => {
    if (!thumbnailTrack) {
      setThumbnailCues([])
      return
    }

    let disposed = false
    const thumbnailUrl = streamProxyUrl(
      thumbnailTrack.file,
      playback.sourceRefererUrl
    )
    void fetch(thumbnailUrl)
      .then((response) => (response.ok ? response.text() : ""))
      .then((text) => {
        if (disposed) return
        setThumbnailCues(
          parseThumbnailVtt(
            text,
            thumbnailTrack.file,
            playback.sourceRefererUrl
          )
        )
      })
      .catch(() => {
        if (!disposed) setThumbnailCues([])
      })

    return () => {
      disposed = true
    }
  }, [playback.sourceRefererUrl, thumbnailTrack])

  const updateHoverPreview = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const percent = Math.min(
      Math.max((event.clientX - rect.left) / rect.width, 0),
      1
    )
    setHoverPercent(percent * 100)
    setHoverTime(duration > 0 ? duration * percent : null)
  }

  return (
    <div className="flex items-center gap-3 text-xs text-white/70">
      <span className="w-12 tabular-nums">{formatTime(currentTime)}</span>
      <div
        className="relative h-5 flex-1"
        onPointerMove={updateHoverPreview}
        onPointerLeave={() => setHoverTime(null)}
      >
        {hoverTime !== null ? (
          <div
            className="pointer-events-none absolute bottom-8 z-20 flex -translate-x-1/2 flex-col items-center gap-1"
            style={{ left: `${hoverPreviewPercent}%` }}
          >
            {thumbnailCue ? (
              <div className="rounded-xl border border-white/10 bg-black/90 p-1 shadow-2xl">
                <ThumbnailPreview image={thumbnailCue.image} />
              </div>
            ) : null}
            {hoverSegmentLabel ? (
              <div className="rounded-md border border-white/10 bg-black/75 px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-white/75 uppercase shadow-xl backdrop-blur">
                {hoverSegmentLabel}
              </div>
            ) : null}
            <p className="rounded-lg border border-white/10 bg-black/85 px-3 py-1.5 text-base font-semibold text-white tabular-nums shadow-2xl backdrop-blur">
              {formatTime(hoverTime)}
            </p>
          </div>
        ) : null}
        <div className="absolute top-1/2 flex h-1 w-full -translate-y-1/2 gap-1">
          {timelineSegments.map((segment) => (
            <div
              key={segment.key}
              className="relative h-1 min-w-1 overflow-hidden rounded-full bg-white/15"
              style={{
                flexGrow: Math.max(segment.end - segment.start, 0.1),
                flexBasis: 0,
              }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-white/25"
                style={{
                  width: `${timelineFillPercent(segment, bufferedEnd)}%`,
                }}
              />
              {hoverTime !== null ? (
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 bg-white/35"
                  style={{
                    width: `${timelineFillPercent(segment, hoverTime)}%`,
                  }}
                />
              ) : null}
              <div
                className="absolute inset-y-0 left-0 bg-white"
                style={{
                  width: `${timelineFillPercent(segment, currentTime)}%`,
                }}
              />
            </div>
          ))}
        </div>
        <input
          aria-label="Seek"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={(event) => onSeek(event.currentTarget.value)}
          className="absolute inset-0 h-5 w-full cursor-pointer opacity-0"
        />
      </div>
      <span className="w-12 text-right tabular-nums">
        {formatTime(duration)}
      </span>
    </div>
  )
}

function ThumbnailPreview({ image }: { image: ThumbnailImage }) {
  if (!image.region) {
    return (
      <img
        className="aspect-video w-40 rounded-lg object-cover"
        src={image.url}
        alt="Seek preview"
      />
    )
  }

  const width = 160
  const scale = width / image.region.width
  const height = image.region.height * scale

  return (
    <div
      className="overflow-hidden rounded-lg bg-black"
      style={{ width, height }}
    >
      <img
        src={image.url}
        alt="Seek preview"
        className="max-w-none origin-top-left"
        style={{
          transform: `translate(-${image.region.x * scale}px, -${
            image.region.y * scale
          }px) scale(${scale})`,
        }}
      />
    </div>
  )
}
