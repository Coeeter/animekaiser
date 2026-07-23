import { expect, test } from "bun:test"
import { safeCallbackUrl } from "./external-lists"

test("external-list callbacks stay on the configured application origin", () => {
  expect(safeCallbackUrl("/settings", "https://kaiser.test")).toBe(
    "https://kaiser.test/settings"
  )
  expect(
    safeCallbackUrl("https://attacker.test/callback", "https://kaiser.test")
  ).toBeNull()
})
