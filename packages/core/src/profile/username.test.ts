import { expect, test } from "bun:test"
import { usernameCandidates, usernameFromEmail } from "./username"

test("username is derived from the email local part", () => {
  expect(usernameFromEmail("Test.User+anime@gmail.com")).toBe("testuseranime")
  expect(usernameFromEmail("claude@aniways.xyz")).toBe("claude")
})

test("short local parts are padded to a usable username", () => {
  expect(usernameFromEmail("me@example.com")).toBe("mekaiser")
  expect(usernameFromEmail("!!@example.com")).toBe("kaiser")
})

test("derived usernames stay within the length limit", () => {
  const derived = usernameFromEmail(`${"a".repeat(40)}@example.com`)
  expect(derived.length).toBeLessThanOrEqual(20)
})

test("candidates start with the bare base and stay unique", () => {
  const candidates = usernameCandidates("claude", 42)

  expect(candidates[0]).toBe("claude")
  expect(new Set(candidates).size).toBe(candidates.length)
  expect(candidates.every((value) => value.length <= 20)).toBe(true)
})

test("candidates keep the length limit for a long base", () => {
  const candidates = usernameCandidates("a".repeat(20), 12345)

  expect(candidates.every((value) => value.length <= 20)).toBe(true)
  expect(new Set(candidates).size).toBe(candidates.length)
})
