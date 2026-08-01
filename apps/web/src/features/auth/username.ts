/**
 * Only used to satisfy sign-up before onboarding asks for a real one, so it
 * trades readability for a collision-free value.
 */
export const provisionalUsername = (email: string) => {
  const local = (email.split("@")[0] ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 10)

  const suffix = Math.random().toString(36).slice(2, 8)
  return `${local || "kaiser"}_${suffix}`
}
