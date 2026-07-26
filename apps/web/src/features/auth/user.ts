import type { AppSession } from "@workspace/domain"

export type AppUser = AppSession["user"]

export const displayUsername = (user: {
  displayUsername?: string | null
  username?: string | null
  name?: string | null
  email?: string | null
}) => user.displayUsername ?? user.username ?? user.name ?? user.email ?? "?"

export const userInitials = (user: Parameters<typeof displayUsername>[0]) =>
  displayUsername(user).slice(0, 2).toUpperCase()

export const safeRedirect = (value: string | undefined) =>
  value?.startsWith("/") && !value.startsWith("//") ? value : "/"
