import * as Atom from "effect/reactivity/Atom"
import * as Schema from "effect/Schema"
import { localStorageRuntime } from "../../services/storage"

export const MiniPlayerFrame = Schema.Struct({
  left: Schema.Number,
  top: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
})
export type MiniPlayerFrame = typeof MiniPlayerFrame.Type

export const miniPlayerMinWidth = 256
export const miniPlayerMinHeight = 144

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

export const miniPlayerFrameAtom = Atom.kvs({
  runtime: localStorageRuntime,
  key: "kaiser-mini-player-frame",
  schema: Schema.NullOr(MiniPlayerFrame),
  defaultValue: (): MiniPlayerFrame | null => null,
}).pipe(Atom.keepAlive)

export const setMiniPlayerFrameAtom = Atom.writable<
  MiniPlayerFrame | null,
  MiniPlayerFrame
>(
  (get) => get(miniPlayerFrameAtom),
  (ctx, frame) => ctx.set(miniPlayerFrameAtom, frame)
)
