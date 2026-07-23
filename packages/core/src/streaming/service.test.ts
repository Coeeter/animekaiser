import { expect, test } from "bun:test"
import {
  streamPlaybackFailureKind,
  streamProviderFailureStatus,
} from "./service"

test("stream failures distinguish unmatched anime from provider outages", () => {
  expect(
    streamProviderFailureStatus("ProviderA could not match this anime.")
  ).toBe("unmatched")
  expect(streamPlaybackFailureKind("ProviderA could not match this anime.")).toBe(
    "provider"
  )
  expect(streamProviderFailureStatus("ProviderA request failed.")).toBe(
    "unavailable"
  )
  expect(streamPlaybackFailureKind("ProviderA request failed.")).toBe(
    "unavailable"
  )
  expect(streamPlaybackFailureKind("ProviderA episode was not found.")).toBe(
    "episode"
  )
})
