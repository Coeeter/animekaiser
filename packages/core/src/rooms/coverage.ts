export type Interval = readonly [number, number]

export const completionCoverageRatio = 0.92

// Sampling gaps, timer jitter, and seek granularity make a few extra seconds
// normal; anything beyond that is a jump, not continuous viewing.
const segmentSlackSeconds = 2

export const mergeIntervals = (
  intervals: ReadonlyArray<Interval>,
  next: Interval
): Array<[number, number]> => {
  const all = [...intervals, next]
    .filter(([start, end]) => end > start)
    .map(([start, end]) => [start, end] as [number, number])
    .sort((left, right) => left[0] - right[0])
  const merged: Array<[number, number]> = []
  for (const [start, end] of all) {
    const last = merged.at(-1)
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  return merged
}

export const coveredSeconds = (intervals: ReadonlyArray<Interval>) =>
  intervals.reduce((total, [start, end]) => total + (end - start), 0)

// A segment is accepted only when its timeline length is explained by the
// wall-clock time that passed at the shared playback rate. The server-side
// elapsed time bounds a client that lies about `elapsedMs`.
export const acceptedSegment = (input: {
  fromSeconds: number
  toSeconds: number
  clientElapsedMs: number
  serverElapsedMs: number | null
  rate: number
  durationSeconds: number | null
}): Interval | null => {
  const { fromSeconds, toSeconds, rate } = input
  if (!(toSeconds > fromSeconds)) return null
  const elapsedMs =
    input.serverElapsedMs === null
      ? Math.min(input.clientElapsedMs, 10_000)
      : Math.min(input.clientElapsedMs, input.serverElapsedMs + 1_000)
  const allowed = (elapsedMs / 1000) * rate + segmentSlackSeconds
  if (toSeconds - fromSeconds > allowed) return null
  const end =
    input.durationSeconds === null
      ? toSeconds
      : Math.min(toSeconds, input.durationSeconds)
  return end > fromSeconds ? [fromSeconds, end] : null
}

export const isCoverageComplete = (
  intervals: ReadonlyArray<Interval>,
  durationSeconds: number | null
) =>
  durationSeconds !== null &&
  durationSeconds > 0 &&
  coveredSeconds(intervals) >= durationSeconds * completionCoverageRatio
