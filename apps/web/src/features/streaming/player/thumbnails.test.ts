import { expect, test } from "bun:test"
import { parseThumbnailVtt, thumbnailAt } from "./thumbnails"

test("parses sprite frames and resolves relative sprite urls", () => {
  const cues = parseThumbnailVtt(
    [
      "WEBVTT",
      "00:00:00.000 --> 00:00:05.000\npreview-01.jpg#xywh=0,0,320,180",
      "00:05.000 --> 00:10.000\nhttps://img.example/full.jpg",
    ].join("\n\n"),
    "https://proxy.example/abc/preview.vtt?sig=1"
  )
  expect(cues).toEqual([
    {
      start: 0,
      end: 5,
      url: "https://proxy.example/abc/preview-01.jpg",
      frame: { x: 0, y: 0, width: 320, height: 180 },
    },
    {
      start: 5,
      end: 10,
      url: "https://img.example/full.jpg",
      frame: null,
    },
  ])
  expect(thumbnailAt(cues, 7)?.url).toBe("https://img.example/full.jpg")
  expect(thumbnailAt(cues, 12)).toBeNull()
})
