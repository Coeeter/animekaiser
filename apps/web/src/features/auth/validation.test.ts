import { expect, test } from "bun:test"
import { passwordConfirmationError } from "./validation"

test("password confirmation rejects mismatched values", () => {
  expect(passwordConfirmationError("password-one", "password-two")).toBe(
    "Passwords do not match"
  )
  expect(passwordConfirmationError("password-one", "password-one")).toBeNull()
})
