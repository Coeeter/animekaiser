import type { StreamPlayback } from "@animekaiser/domain"
import type { PointerEvent } from "react"
import { useEffect, useState } from "react"
import { formatTime } from "../player-format"

type TimelineSegment = {
  key: string
  start: number
  end: number
  kind: "main" | "opening" | "ending"
}

type TimelineChapter = Omit<TimelineSegment, "key" | "kind"> & {
  kind: "opening" | "ending"
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
  const timelineSegments = chapterTimelineSegments({
    intro: playback.intro,
    outro: playback.outro,
    duration,
  })
  const hoverSegment = segmentAtTime(timelineSegments, hoverTime)
  const hoverSegmentLabel = timelineSegmentLabel(hoverSegment)
  const hoverPreviewPercent = Math.min(Math.max(hoverPercent, 4), 96)

  useEffect(() => {
    setHoverTime(null)
  }, [playback.episode.id, playback.provider, playback.audio])

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
    <div className="flex items-center gap-2 text-xs text-white/70 md:gap-3">
      <span className="w-10 tabular-nums md:w-12">
        {formatTime(currentTime)}
      </span>
      <div
        className="relative h-8 flex-1 md:h-5"
        onPointerMove={updateHoverPreview}
        onPointerLeave={() => setHoverTime(null)}
      >
        {hoverTime !== null ? (
          <div
            className="pointer-events-none absolute bottom-8 z-20 flex -translate-x-1/2 flex-col items-center gap-1"
            style={{ left: `${hoverPreviewPercent}%` }}
          >
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
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <span className="w-10 text-right tabular-nums md:w-12">
        {formatTime(duration)}
      </span>
    </div>
  )
}
