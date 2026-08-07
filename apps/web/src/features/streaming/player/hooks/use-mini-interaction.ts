import type { PointerEvent, RefObject } from "react"
import { useRef } from "react"
import type { MiniPlayerFrame } from "../../mini-player-frame"
import {
  clampMiniPlayerFrame,
  miniPlayerMinHeight,
  miniPlayerMinWidth,
} from "../../mini-player-frame"

export type MiniResizeDirection =
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "nw"

type MiniInteraction = {
  kind: "drag" | "resize"
  direction?: MiniResizeDirection
  pointerId: number
  x: number
  y: number
  bounds: DOMRect
  moved: boolean
}

const applyFrame = (player: HTMLElement, frame: MiniPlayerFrame): void => {
  player.style.left = `${frame.left}px`
  player.style.top = `${frame.top}px`
  player.style.width = `${frame.width}px`
  player.style.height = `${frame.height}px`
  player.style.right = "auto"
  player.style.bottom = "auto"
}

const miniPlayerFrameProperties = [
  "left",
  "top",
  "right",
  "bottom",
  "width",
  "height",
] as const

export function useMiniPlayerInteraction({
  playerRef,
  setMiniPlayerFrame,
  mode,
}: {
  playerRef: RefObject<HTMLDivElement | null>
  setMiniPlayerFrame: (frame: MiniPlayerFrame) => void
  mode: "full" | "mini"
}) {
  const interactionRef = useRef<MiniInteraction | null>(null)
  const suppressVideoClickRef = useRef(false)

  const beginInteraction = (event: PointerEvent<HTMLDivElement>) => {
    if (mode !== "mini" || !playerRef.current || event.button !== 0) return
    if ((event.target as HTMLElement).closest("button, a, input")) return

    const resizeHandle = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-mini-resize]"
    )
    interactionRef.current = {
      kind: resizeHandle ? "resize" : "drag",
      direction: resizeHandle?.dataset.miniResize as
        | MiniResizeDirection
        | undefined,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      bounds: playerRef.current.getBoundingClientRect(),
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveInteraction = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current
    const player = playerRef.current
    if (!interaction || !player || interaction.pointerId !== event.pointerId)
      return

    const dx = event.clientX - interaction.x
    const dy = event.clientY - interaction.y
    if (Math.abs(dx) + Math.abs(dy) > 3) interaction.moved = true
    if (!interaction.moved) return

    const bounds = interaction.bounds
    let left = bounds.left
    let top = bounds.top
    let width = bounds.width
    let height = bounds.height

    if (interaction.kind === "drag") {
      left = Math.min(
        Math.max(0, bounds.left + dx),
        window.innerWidth - bounds.width
      )
      top = Math.min(
        Math.max(0, bounds.top + dy),
        window.innerHeight - bounds.height
      )
    } else {
      const direction = interaction.direction ?? "se"
      if (direction.includes("e"))
        width = Math.min(
          Math.max(miniPlayerMinWidth, bounds.width + dx),
          window.innerWidth - bounds.left
        )
      if (direction.includes("s"))
        height = Math.min(
          Math.max(miniPlayerMinHeight, bounds.height + dy),
          window.innerHeight - bounds.top
        )
      if (direction.includes("w")) {
        width = Math.min(
          Math.max(miniPlayerMinWidth, bounds.width - dx),
          bounds.right
        )
        left = bounds.right - width
      }
      if (direction.includes("n")) {
        height = Math.min(
          Math.max(miniPlayerMinHeight, bounds.height - dy),
          bounds.bottom
        )
        top = bounds.bottom - height
      }
    }

    applyFrame(player, { left, top, width, height })
  }

  const endInteraction = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return
    suppressVideoClickRef.current =
      interaction.kind === "drag" && interaction.moved
    interactionRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)

    if (!interaction.moved || !playerRef.current) return

    const { left, top, width, height } =
      playerRef.current.getBoundingClientRect()
    setMiniPlayerFrame({ left, top, width, height })
  }

  const applyMiniPlayerFrame = (
    player: HTMLElement,
    frame: MiniPlayerFrame
  ): void => {
    const clamped = clampMiniPlayerFrame(frame, {
      width: window.innerWidth,
      height: window.innerHeight,
    })
    applyFrame(player, clamped)
  }

  const clearMiniPlayerFrame = (player: HTMLElement): void => {
    for (const property of miniPlayerFrameProperties)
      player.style.removeProperty(property)
  }

  return {
    beginInteraction,
    moveInteraction,
    endInteraction,
    suppressVideoClickRef,
    applyMiniPlayerFrame,
    clearMiniPlayerFrame,
  } as const
}
