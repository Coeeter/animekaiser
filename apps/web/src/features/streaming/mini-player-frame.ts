import { Atom } from "@effect-atom/atom-react"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

export const MiniPlayerFrame = Schema.Struct({
  left: Schema.Number,
  top: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
})
export type MiniPlayerFrame = typeof MiniPlayerFrame.Type

export const miniPlayerMinWidth = 256
export const miniPlayerMinHeight = 144

export const miniPlayerFrameStorageKey = "kaiser-mini-player-frame"

const StoredMiniPlayerFrame = Schema.parseJson(MiniPlayerFrame)
const decodeStoredMiniPlayerFrameOption = Schema.decodeUnknownOption(
  StoredMiniPlayerFrame
)

export const readStoredMiniPlayerFrame = (
  value: string | null
): MiniPlayerFrame | null =>
  value === null
    ? null
    : decodeStoredMiniPlayerFrameOption(value).pipe(Option.getOrNull)

export const clampMiniPlayerFrame = (
  frame: MiniPlayerFrame,
  viewport: { width: number; height: number }
): MiniPlayerFrame => {
  const width = Math.min(
    Math.max(frame.width, miniPlayerMinWidth),
    viewport.width
  )
  const height = Math.min(
    Math.max(frame.height, miniPlayerMinHeight),
    viewport.height
  )

  return {
    width,
    height,
    left: Math.min(Math.max(0, frame.left), viewport.width - width),
    top: Math.min(Math.max(0, frame.top), viewport.height - height),
  }
}

export const miniPlayerFrameAtom = Atom.make<MiniPlayerFrame | null>(
  typeof window === "undefined"
    ? null
    : readStoredMiniPlayerFrame(
        window.localStorage.getItem(miniPlayerFrameStorageKey)
      )
).pipe(Atom.keepAlive)

export const writeStoredMiniPlayerFrame = (frame: MiniPlayerFrame) => {
  if (typeof window === "undefined") return

  window.localStorage.setItem(miniPlayerFrameStorageKey, JSON.stringify(frame))
}

export const setMiniPlayerFrameAtom = Atom.writable<
  MiniPlayerFrame | null,
  MiniPlayerFrame
>(
  (get) => get(miniPlayerFrameAtom),
  (ctx, frame) => {
    writeStoredMiniPlayerFrame(frame)
    ctx.set(miniPlayerFrameAtom, frame)
  }
)
