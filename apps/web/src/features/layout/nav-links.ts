import type { LucideIcon } from "lucide-react"
import {
  Bookmark,
  CalendarDays,
  Clapperboard,
  Compass,
  History,
  Home,
  Shuffle,
  Sparkles,
  User,
} from "lucide-react"

export type NavItem = { title: string; href: string; icon: LucideIcon }

export const mainLinks: ReadonlyArray<NavItem> = [
  { title: "Home", href: "/", icon: Home },
  { title: "Browse", href: "/series", icon: Compass },
  { title: "Discover", href: "/discover", icon: Sparkles },
  { title: "Random", href: "/random", icon: Shuffle },
  { title: "Latest Episodes", href: "/latest-episodes", icon: Clapperboard },
  { title: "Schedule", href: "/schedule", icon: CalendarDays },
]

export const personalLinks: ReadonlyArray<NavItem> = [
  { title: "Profile", href: "/profile", icon: User },
  { title: "My List", href: "/my-list", icon: Bookmark },
  { title: "Watch History", href: "/watch-history", icon: History },
]
