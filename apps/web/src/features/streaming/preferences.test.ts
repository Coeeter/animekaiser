import { expect, test } from "bun:test"
import {
  defaultPlayerPreferences,
  readStoredPlayerPreferences,
} from "./preferences"

test("stored player preferences migrate missing fields to current defaults", () => {
  expect(readStoredPlayerPreferences('{"autoplay":true}')).toEqual({
    ...defaultPlayerPreferences,
    autoplay: true,
  })
})

test("invalid player preferences fall back safely", () => {
  expect(readStoredPlayerPreferences("not-json")).toEqual(
    defaultPlayerPreferences
  )
  expect(readStoredPlayerPreferences('{"videoFit":"stretch"}')).toEqual(
    defaultPlayerPreferences
  )
})

test("preferred quality survives decoding alongside existing settings", () => {
  expect(
    readStoredPlayerPreferences('{"preferredQuality":1080,"autoplay":true}')
  ).toEqual({
    ...defaultPlayerPreferences,
    preferredQuality: 1080,
    autoplay: true,
  })
})
