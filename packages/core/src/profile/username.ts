const minLength = 3
const maxLength = 20

export const usernameFromEmail = (email: string) => {
  const local = email.split("@")[0] ?? ""
  const slug = local
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, maxLength)

  return slug.length >= minLength ? slug : `${slug}kaiser`.slice(0, maxLength)
}

const withSuffix = (base: string, suffix: string) =>
  `${base.slice(0, maxLength - suffix.length)}${suffix}`

/**
 * Ordered widest-first so the caller can take the first few that are free
 * without ever running out of candidates for a heavily contested base.
 */
export const usernameCandidates = (base: string, seed: number) => {
  const suffixes = [
    "",
    String(seed % 100),
    `_${(seed % 900) + 100}`,
    String((seed % 9000) + 1000),
    `_${base.length}${(seed % 90) + 10}`,
    String((seed % 90000) + 10000),
  ]

  return suffixes.map((suffix) => withSuffix(base, suffix))
}
