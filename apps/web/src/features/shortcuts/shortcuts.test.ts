import { expect, test } from "bun:test"
import {
  bindingFromEvent,
  matchesAction,
  matchesBinding,
  resolveShortcuts,
} from "./shortcuts"

const press = (key: string, modifiers: Partial<KeyboardEvent> = {}) =>
  ({
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  }) as KeyboardEvent

test("an override replaces the default bindings of only that action", () => {
  const shortcuts = resolveShortcuts({ mute: [{ key: "x", mod: false }] })

  expect(matchesAction(press("x"), shortcuts, "mute")).toBe(true)
  expect(matchesAction(press("m"), shortcuts, "mute")).toBe(false)
  expect(matchesAction(press("f"), shortcuts, "fullscreen")).toBe(true)
})

test("⌘ and Ctrl both count as the modifier, and must match exactly", () => {
  const binding = { key: "k", mod: true }

  expect(matchesBinding(press("k", { metaKey: true }), binding)).toBe(true)
  expect(matchesBinding(press("K", { ctrlKey: true }), binding)).toBe(true)
  expect(matchesBinding(press("k"), binding)).toBe(false)
  expect(
    matchesBinding(press("k", { metaKey: true }), { key: "k", mod: false })
  ).toBe(false)
})

test("Alt combinations never match", () => {
  expect(
    matchesBinding(press("m", { altKey: true }), { key: "m", mod: false })
  ).toBe(false)
})

test("recording waits for a real key, not a lone modifier", () => {
  expect(bindingFromEvent(press("Meta", { metaKey: true }))).toBeNull()
  expect(bindingFromEvent(press("ArrowLeft"))).toEqual({
    key: "arrowleft",
    mod: false,
  })
  expect(bindingFromEvent(press("j", { ctrlKey: true }))).toEqual({
    key: "j",
    mod: true,
  })
})
