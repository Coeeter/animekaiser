import { createKaiserAuthClient } from "@workspace/auth/web"
import type { AppSession } from "@workspace/domain"

export const apiUrl = import.meta.env.VITE_API_URL
if (!apiUrl) throw new Error("Missing VITE_API_URL")

export const authClient = createKaiserAuthClient({ baseURL: apiUrl })

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
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/"
