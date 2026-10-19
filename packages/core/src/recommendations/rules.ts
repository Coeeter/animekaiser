import type { AnimeItem, RecapRequest } from "@animekaiser/domain"

export const aiLimits = {
  userDaily: 20,
  guestDaily: 5,
  roomDaily: 100,
  monthlyUsd: 10,
} as const

// Agent runs stop taking new steps once their reported cost passes the cap;
// the final answer turn and an in-flight step can still add a little, so the
// reservation keeps headroom above it.
// Recommendations may add two research requests on top of their own cap.
export const agentCostCap = {
  recommend: 0.04,
  research: 0.02,
  recap: 0.12,
} as const
export const reservationUsd = { recommend: 0.09, recap: 0.16 } as const

export const fitsBudget = (
  month: { reservedUsd: number; spentUsd: number },
  amount: number,
  cap: number = aiLimits.monthlyUsd
) => month.reservedUsd + month.spentUsd + amount <= cap + 1e-9

export type Criteria = {
  genres: ReadonlyArray<string>
  excludeGenres: ReadonlyArray<string>
  formats: ReadonlyArray<string>
  maxEpisodes: number | null
}

export type CandidateCheck = { candidate: AnimeItem; notes: Array<string> }

// Hard constraints are enforced in code. Unknown metadata is kept but labelled
// rather than treated as satisfying the constraint.
export const filterCandidates = (
  candidates: ReadonlyArray<AnimeItem>,
  criteria: Criteria,
  excluded: ReadonlySet<number>
): Array<CandidateCheck> => {
  const lower = (values: ReadonlyArray<string>) =>
    values.map((value) => value.toLowerCase())
  const exclude = new Set(lower(criteria.excludeGenres))
  const formats = new Set(criteria.formats.map((value) => value.toUpperCase()))
  const seen = new Set<number>()
  const result: Array<CandidateCheck> = []
  for (const candidate of candidates) {
    if (seen.has(candidate.malId) || excluded.has(candidate.malId)) continue
    seen.add(candidate.malId)
    if (candidate.isAdult) continue
    if (lower(candidate.genres).some((genre) => exclude.has(genre))) continue
    const notes: Array<string> = []
    if (formats.size > 0) {
      if (candidate.format === null) notes.push("Format unknown")
      else if (!formats.has(candidate.format)) continue
    }
    if (criteria.maxEpisodes !== null) {
      if (candidate.episodes === null) notes.push("Episode count unknown")
      else if (candidate.episodes > criteria.maxEpisodes) continue
    }
    result.push({ candidate, notes })
  }
  return result
}

export const normalizeUrl = (value: string) => {
  if (!URL.canParse(value)) return null
  const url = new URL(value)
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}${url.search}`
}

// A model-returned URL is accepted only if the provider actually surfaced it
// as a citation for this request; plausible-looking URLs are not evidence.
export const supportedUrls = (
  claimed: ReadonlyArray<string>,
  cited: ReadonlyArray<string>
) => {
  const allowed = new Map<string, string>()
  for (const url of cited) {
    const key = normalizeUrl(url)
    if (key) allowed.set(key, url)
  }
  return claimed.flatMap((url) => {
    const key = normalizeUrl(url)
    const match = key ? allowed.get(key) : undefined
    return match ? [match] : []
  })
}

const rangeLabel = (entry: RecapRequest["entries"][number]) =>
  entry.fromEpisode === entry.toEpisode
    ? `${entry.title} episode ${entry.fromEpisode}`
    : `${entry.title} episodes ${entry.fromEpisode}–${entry.toEpisode}`

export const recapBoundary = (request: RecapRequest) => ({
  contains: `Contains spoilers for ${request.entries.map(rangeLabel).join(", ")}`,
  excludes: request.excludes
    ? `Excludes ${request.excludes}`
    : "Excludes later episodes",
})

export const validRecapRequest = (request: RecapRequest) =>
  request.entries.every(
    (entry) =>
      entry.toEpisode >= entry.fromEpisode &&
      entry.toEpisode - entry.fromEpisode < 60
  )
