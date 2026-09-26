import { Atom } from "@effect-atom/atom-react"
import * as Effect from "effect/Effect"

export type ThumbnailCue = {
  start: number
  end: number
  url: string
  frame: { x: number; y: number; width: number; height: number } | null
}

const parseTimestamp = (value: string) => {
  const parts = value.trim().split(":").map(Number)
  if (parts.some((part) => !Number.isFinite(part))) return null
  return parts.reduce((total, part) => total * 60 + part, 0)
}

export const parseThumbnailVtt = (
  vtt: string,
  baseUrl: string
): Array<ThumbnailCue> =>
  vtt.split(/\r?\n\r?\n/).flatMap((block) => {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    const timingIndex = lines.findIndex((line) => line.includes("-->"))
    const target = lines[timingIndex + 1]
    if (timingIndex < 0 || !target) return []
    const [from = "", to = ""] = (lines[timingIndex] ?? "").split("-->")
    const start = parseTimestamp(from)
    const end = parseTimestamp(to.trim().split(/\s+/)[0] ?? "")
    if (start === null || end === null) return []

    const [path = "", fragment] = target.split("#xywh=")
    const [x, y, width, height] = (fragment ?? "").split(",").map(Number)
    let url: string
    try {
      url = new URL(path, baseUrl).toString()
    } catch {
      return []
    }
    const frame =
      [x, y, width, height].every((value) => Number.isFinite(value)) &&
      width !== undefined &&
      height !== undefined &&
      width > 0 &&
      height > 0
        ? { x: x ?? 0, y: y ?? 0, width, height }
        : null
    return [{ start, end, url, frame }]
  })

export const thumbnailCuesAtom = Atom.family((url: string | null) =>
  Atom.make(
    url === null
      ? Effect.succeed<ReadonlyArray<ThumbnailCue>>([])
      : Effect.tryPromise(() =>
          fetch(url).then((response) => response.text())
        ).pipe(
          Effect.map((vtt) => parseThumbnailVtt(vtt, url)),
          Effect.orElseSucceed((): ReadonlyArray<ThumbnailCue> => [])
        )
  ).pipe(Atom.keepAlive)
)

export const thumbnailAt = (cues: ReadonlyArray<ThumbnailCue>, time: number) =>
  cues.find((cue) => time >= cue.start && time < cue.end) ?? null
