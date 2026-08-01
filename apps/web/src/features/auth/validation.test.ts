import { expect, test } from "bun:test"
import { passwordConfirmationError, signInErrorMessage } from "./validation"

test("password confirmation rejects mismatched values", () => {
  expect(passwordConfirmationError("password-one", "password-two")).toBe(
    "Passwords do not match"
  )
  expect(passwordConfirmationError("password-one", "password-one")).toBeNull()
})

test("sign-in errors do not reveal whether an account exists", () => {
  expect(signInErrorMessage({ message: "User not found" })).toBe(
    signInErrorMessage({ message: "Invalid password" })
  )
})
