import type { LucideIcon } from "lucide-react"
import { Laptop, Smartphone, Tablet } from "lucide-react"

export type DeviceInfo = { icon: LucideIcon; label: string; detail: string }

export const describeUserAgent = (
  userAgent: string | null | undefined
): DeviceInfo => {
  if (!userAgent) return { icon: Laptop, label: "Unknown device", detail: "" }

  const tablet = /iPad|Tablet/i.test(userAgent)
  const phone = !tablet && /Mobi|iPhone|Android/i.test(userAgent)
  const icon = tablet ? Tablet : phone ? Smartphone : Laptop
  const browser = /Edg\//i.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/i.test(userAgent)
      ? "Opera"
      : /Chrome\//i.test(userAgent)
        ? "Chrome"
        : /Safari\//i.test(userAgent)
          ? "Safari"
          : /Firefox\//i.test(userAgent)
            ? "Firefox"
            : "Unknown browser"
  const os = /Windows NT/i.test(userAgent)
    ? "Windows"
    : /Mac OS X/i.test(userAgent)
      ? tablet
        ? "iPadOS"
        : phone
          ? "iOS"
          : "macOS"
      : /Android/i.test(userAgent)
        ? "Android"
        : /Linux/i.test(userAgent)
          ? "Linux"
          : "Unknown OS"

  return { icon, label: `${browser} on ${os}`, detail: os }
}
