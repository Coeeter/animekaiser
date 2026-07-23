import { expect, test } from "bun:test"
import {
  decodeLibraryProgress,
  decodeLibraryScore,
  libraryEntryFormDefaults,
} from "./form"

test("library form values reject invalid progress and score input", () => {
  expect(decodeLibraryProgress(" 12 ")).toBe(12)
  expect(decodeLibraryProgress("-1")).toBe(0)
  expect(decodeLibraryProgress("1.5")).toBe(0)
  expect(decodeLibraryScore(" 88 ")).toBe(88)
  expect(decodeLibraryScore("101")).toBeNull()
  expect(decodeLibraryScore("")).toBeNull()
})

test("new library entries use the requested fallback status", () => {
  expect(libraryEntryFormDefaults(null, "watching")).toEqual({
    status: "watching",
    progress: "0",
    score: "",
    notes: "",
  })
})
