import { expect, test } from "bun:test"
import { formatCountdown, getCurrentWeek, scheduleRange } from "./schedule"

test("builds one-day schedule ranges from viewer-local midnight", () => {
  const date = new Date(2026, 5, 17, 14, 30)
  const range = scheduleRange("wednesday", date)
  expect(range.to - range.from).toBe(86_400)
  expect(new Date(range.from * 1000).getHours()).toBe(0)
})

test("builds a complete Sunday-to-Saturday viewer week", () => {
  const week = getCurrentWeek(new Date(2026, 5, 17, 14, 30))
  expect(week.map(({ day }) => day)).toEqual([
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ])
  expect(week[0]?.date.getHours()).toBe(0)
})

test("formats countdowns without negative time", () => {
  expect(formatCountdown(100, 101_000)).toBe("Airing now")
  expect(formatCountdown(3_661, 0)).toBe("01h 01m 01s")
})
