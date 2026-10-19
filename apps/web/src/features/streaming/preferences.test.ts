import { expect, test } from "bun:test"
import * as Option from "effect/Option"
import { decodeStored } from "../../utils/stored"
import { defaultPlayerPreferences, PlayerPreferences } from "./preferences"

const read = (raw: string) =>
  Option.getOrElse(
    decodeStored(PlayerPreferences, raw),
    () => defaultPlayerPreferences
  )

test("stored player preferences migrate missing fields to current defaults", () => {
  expect(read('{"autoplay":true}')).toEqual({
    ...defaultPlayerPreferences,
    autoplay: true,
  })
})

test("invalid player preferences fall back safely", () => {
  expect(read("not-json")).toEqual(defaultPlayerPreferences)
  expect(read('{"videoFit":"stretch"}')).toEqual(defaultPlayerPreferences)
})

test("preferred quality survives decoding alongside existing settings", () => {
  expect(read('{"preferredQuality":1080,"autoplay":true}')).toEqual({
    ...defaultPlayerPreferences,
    preferredQuality: 1080,
    autoplay: true,
  })
})
