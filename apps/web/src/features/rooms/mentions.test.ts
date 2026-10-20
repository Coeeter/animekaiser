import { expect, test } from "bun:test"
import { hasAiMention, memberMention, mentionQueryAt } from "./mentions"

test("AI is invoked only by a complete, standalone mention", () => {
  for (const text of [
    "@AI suggest a comedy",
    "hey @Ai, any ideas?",
    "hello @ai",
  ])
    expect(hasAiMention(text)).toBe(true)
  for (const text of [
    "hello everyone",
    "ai",
    "@Aimee hello",
    "name@ai.com",
    "@airing",
    "@AI_helper",
  ])
    expect(hasAiMention(text)).toBe(false)
})

test("mention suggestions follow the caret and ignore email addresses and completed mentions", () => {
  expect(mentionQueryAt("hello @na", 9)).toEqual({
    start: 6,
    end: 9,
    query: "na",
  })
  expect(mentionQueryAt("@", 1)?.query).toBe("")
  expect(mentionQueryAt("@nas more", 4)?.query).toBe("nas")
  expect(mentionQueryAt("@nas ", 5)).toBeNull()
  expect(mentionQueryAt("nas@example.com", 15)).toBeNull()
  expect(mentionQueryAt("@AI\nhello", 9)).toBeNull()
})

test("member tags use usernames and guest names remain one token", () => {
  expect(memberMention({ username: "nas", displayName: "Nas" })).toBe("nas")
  expect(memberMention({ username: null, displayName: "Guest Name" })).toBe(
    "Guest_Name"
  )
})
