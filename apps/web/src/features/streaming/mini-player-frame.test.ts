import { expect, test } from "bun:test"
import {
  clampMiniPlayerFrame,
  readStoredMiniPlayerFrame,
} from "./mini-player-frame"

test("stored mini player frame round trips", () => {
  expect(
    readStoredMiniPlayerFrame('{"left":10,"top":20,"width":384,"height":216}')
  ).toEqual({ left: 10, top: 20, width: 384, height: 216 })
})

test("missing or invalid mini player frame falls back to no frame", () => {
  expect(readStoredMiniPlayerFrame(null)).toBeNull()
  expect(readStoredMiniPlayerFrame("not-json")).toBeNull()
  expect(readStoredMiniPlayerFrame('{"left":10}')).toBeNull()
})

test("mini player frame is clamped into the current viewport", () => {
  expect(
    clampMiniPlayerFrame(
      { left: 1800, top: 1200, width: 384, height: 216 },
      { width: 1024, height: 768 }
    )
  ).toEqual({ left: 640, top: 552, width: 384, height: 216 })
})

test("mini player frame respects minimum size", () => {
  expect(
    clampMiniPlayerFrame(
      { left: -50, top: -50, width: 10, height: 10 },
      { width: 1024, height: 768 }
    )
  ).toEqual({ left: 0, top: 0, width: 256, height: 144 })
})
