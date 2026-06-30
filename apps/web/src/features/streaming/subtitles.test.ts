import { expect, test } from "bun:test"
import { parseSubtitleVtt, subtitleHtmlAtTime } from "./subtitles"

test("parses active subtitle cues from VTT", () => {
  const cues = parseSubtitleVtt(`WEBVTT

00:00:02.070 --> 00:00:03.540
Morning.

00:00:21.610 --> 00:00:24.120 align:start
So which one are you right now?
`)

  expect(subtitleHtmlAtTime(cues, 2.5)).toBe("Morning.")
  expect(subtitleHtmlAtTime(cues, 22)).toBe("So which one are you right now?")
  expect(subtitleHtmlAtTime(cues, 4)).toBeNull()
})

test("preserves safe subtitle markup", () => {
  const cues = parseSubtitleVtt(`WEBVTT

00:00:01.000 --> 00:00:02.000
<b>Bold</b> and <i>italic</i> with <script>alert(1)</script>
`)

  expect(subtitleHtmlAtTime(cues, 1.5)).toBe(
    "<b>Bold</b> and <i>italic</i> with &lt;script&gt;alert(1)&lt;/script&gt;"
  )
})
