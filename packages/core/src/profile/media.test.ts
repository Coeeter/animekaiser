import { expect, test } from "bun:test"
import { isValidProfileImage, isValidProfileImageSize } from "./media"

test("profile uploads accept supported images up to five megabytes", () => {
  expect(isValidProfileImageSize(1)).toBe(true)
  expect(isValidProfileImageSize(5 * 1024 * 1024)).toBe(true)
  expect(isValidProfileImageSize(0)).toBe(false)
  expect(isValidProfileImageSize(5 * 1024 * 1024 + 1)).toBe(false)
  expect(isValidProfileImage({ size: 20, type: "image/webp" })).toBe(true)
  expect(isValidProfileImage({ size: 20, type: "image/gif" })).toBe(false)
})
