import type { AnimeItem, AnimeScheduleDay } from "@workspace/domain"
import { getAnimeTitle } from "../common/title"

export const scheduleDays: ReadonlyArray<AnimeScheduleDay> = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]

export const getTodayScheduleDay = (date = new Date()): AnimeScheduleDay =>
  scheduleDays[date.getDay()] ?? "sunday"

export const getCurrentWeek = (date = new Date()) => {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())
  return scheduleDays.map((day, index) => {
    const value = new Date(start)
    value.setDate(start.getDate() + index)
    return { day, date: value }
  })
}

export const scheduleRange = (day: AnimeScheduleDay, date = new Date()) => {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay() + scheduleDays.indexOf(day))
  const end = new Date(start)
  end.setDate(start.getDate() + 1)
  return {
    from: Math.floor(start.getTime() / 1000),
    to: Math.floor(end.getTime() / 1000),
  }
}

export const sortScheduleItems = (items: ReadonlyArray<AnimeItem>) =>
  [...items].sort((left, right) => {
    const leftTime = left.nextAiringEpisode?.airingAt ?? Number.MAX_SAFE_INTEGER
    const rightTime =
      right.nextAiringEpisode?.airingAt ?? Number.MAX_SAFE_INTEGER
    return (
      leftTime - rightTime ||
      getAnimeTitle(left.title, "english").localeCompare(
        getAnimeTitle(right.title, "english")
      )
    )
  })

export const formatCountdown = (targetSeconds: number, nowMs = Date.now()) => {
  const remaining = targetSeconds * 1000 - nowMs
  if (remaining <= 0) return "Airing now"
  const totalSeconds = Math.floor(remaining / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => String(value).padStart(2, "0")
  return days > 0
    ? `${days}d ${pad(hours)}h ${pad(minutes)}m`
    : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
}
