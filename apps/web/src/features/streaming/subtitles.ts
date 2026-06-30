export type SubtitleCue = {
  start: number
  end: number
  html: string
}

const timePartSeconds = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const parseTimestamp = (value: string) => {
  const timestamp = value.trim().split(" ")[0] ?? "0"
  const parts = timestamp.split(":")
  if (parts.length === 3) {
    return (
      timePartSeconds(parts[0] ?? "0") * 3600 +
      timePartSeconds(parts[1] ?? "0") * 60 +
      timePartSeconds(parts[2] ?? "0")
    )
  }
  if (parts.length === 2) {
    return (
      timePartSeconds(parts[0] ?? "0") * 60 + timePartSeconds(parts[1] ?? "0")
    )
  }
  return timePartSeconds(timestamp)
}

const escapeSubtitleText = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const allowSubtitleMarkup = (value: string) =>
  value.replaceAll(/&lt;(\/?)(b|i|u)&gt;/gi, "<$1$2>")

export const parseSubtitleVtt = (text: string): Array<SubtitleCue> => {
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n")
  const cues: Array<SubtitleCue> = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? ""
    if (!line.includes("-->")) continue

    const [start = "0", end = "0"] = line
      .split("-->")
      .map((value) => value.trim())
    const cueLines: Array<string> = []

    for (let cueIndex = index + 1; cueIndex < lines.length; cueIndex += 1) {
      const cueLine = lines[cueIndex]?.trim() ?? ""
      if (cueLine.length === 0) break
      cueLines.push(cueLine)
    }

    if (cueLines.length === 0) continue
    cues.push({
      start: parseTimestamp(start),
      end: parseTimestamp(end),
      html: cueLines
        .map((cueLine) => allowSubtitleMarkup(escapeSubtitleText(cueLine)))
        .join("<br />"),
    })
  }

  return cues
}

export const subtitleHtmlAtTime = (
  cues: ReadonlyArray<SubtitleCue>,
  time: number
) => {
  const active = cues.filter((cue) => time >= cue.start && time <= cue.end)
  return active.length > 0 ? active.map((cue) => cue.html).join("<br />") : null
}
