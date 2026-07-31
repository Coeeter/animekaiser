import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@animekaiser/ui/components/avatar"
import { Button } from "@animekaiser/ui/components/button"
import { Separator } from "@animekaiser/ui/components/separator"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@animekaiser/ui/components/sheet"
import { cn } from "@animekaiser/ui/lib/utils"
import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Link, useLocation } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"
import {
  Bookmark,
  Clapperboard,
  Compass,
  History,
  Home,
  LogIn,
  MoreHorizontal,
  RefreshCcw,
  Search,
  Settings2,
  Shuffle,
  Sparkles,
  User,
} from "lucide-react"
import { useState } from "react"
import { ModeToggle } from "../../components/theme"
import { searchOpenAtom } from "../anime/common/search-atoms"
import { sessionAtom } from "../auth/atoms"
import { displayUsername, userInitials } from "../auth/user"
import { settingsOpenAtom, settingsSectionAtom } from "../settings/atoms"

type MoreLink = {
  title: string
  href: string
  icon: LucideIcon
  description: string
  requiresAuth?: boolean
}

const moreLinks: ReadonlyArray<MoreLink> = [
  {
    title: "Discover",
    href: "/discover",
    icon: Sparkles,
    description: "Trending, seasonal, and top rated",
  },
  {
    title: "Latest episodes",
    href: "/latest-episodes",
    icon: Clapperboard,
    description: "Freshly released episodes",
  },
  {
    title: "Random",
    href: "/random",
    icon: Shuffle,
    description: "Surprise me with something",
  },
  {
    title: "Watch history",
    href: "/watch-history",
    icon: History,
    description: "Pick up where you left off",
    requiresAuth: true,
  },
  {
    title: "Sync activity",
    href: "/sync-activity",
    icon: RefreshCcw,
    description: "External list sync status",
    requiresAuth: true,
  },
]

const isRouteActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href)

export function MobileNav() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const setSearchOpen = useAtomSet(searchOpenAtom)
  const [moreOpen, setMoreOpen] = useState(false)

  if (pathname.startsWith("/watch/")) return null

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="grid grid-cols-5">
          <MobileNavTab
            label="Home"
            icon={Home}
            href="/"
            active={isRouteActive(pathname, "/")}
          />
          <MobileNavTab
            label="Browse"
            icon={Compass}
            href="/series"
            active={isRouteActive(pathname, "/series")}
          />
          <MobileNavTab
            label="Search"
            icon={Search}
            onClick={() => setSearchOpen(true)}
          />
          <MobileNavTab
            label="My list"
            icon={Bookmark}
            href="/my-list"
            active={isRouteActive(pathname, "/my-list")}
          />
          <MobileNavTab
            label="More"
            icon={MoreHorizontal}
            onClick={() => setMoreOpen(true)}
            active={moreOpen}
          />
        </ul>
      </nav>

      <MobileMoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        pathname={pathname}
      />
    </>
  )
}

function MobileNavTab({
  label,
  icon: Icon,
  href,
  onClick,
  active = false,
}: {
  label: string
  icon: LucideIcon
  href?: string
  onClick?: () => void
  active?: boolean
}) {
  const inner = (
    <>
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary transition-opacity",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <Icon
        className={cn("size-5 transition-transform", active && "scale-110")}
      />
      <span className="text-[10px] leading-none font-medium tracking-wide">
        {label}
      </span>
    </>
  )

  const className = cn(
    "relative flex h-full min-h-14 w-full flex-col items-center justify-center gap-1 transition-colors",
    active ? "text-primary" : "text-muted-foreground active:text-foreground"
  )

  return (
    <li className="contents">
      {href ? (
        <Link
          to={href}
          className={className}
          aria-current={active ? "page" : undefined}
        >
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={className}>
          {inner}
        </button>
      )}
    </li>
  )
}

function MobileMoreSheet({
  open,
  onOpenChange,
  pathname,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pathname: string
}) {
  const sessionResult = useAtomValue(sessionAtom)
  const setSettingsSection = useAtomSet(settingsSectionAtom)
  const setSettingsOpen = useAtomSet(settingsOpenAtom)

  const user = Result.builder(sessionResult)
    .onSuccess((session) => session?.user ?? null)
    .orNull()

  const openSettings = () => {
    onOpenChange(false)
    setSettingsSection("Account")
    setSettingsOpen(true)
  }

  const links = moreLinks.filter((link) => !link.requiresAuth || user)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false}>
        <SheetHeader className="pb-3">
          <SheetTitle>Browse everything</SheetTitle>
          <SheetDescription>Jump to the rest of AnimeKaiser.</SheetDescription>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-2">
          {user ? (
            <Link
              to="/profile"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 rounded-2xl border bg-card/70 p-3 transition active:bg-accent"
            >
              <Avatar className="size-11">
                <AvatarImage
                  src={user.image ?? undefined}
                  alt={displayUsername(user)}
                />
                <AvatarFallback>{userInitials(user)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {displayUsername(user)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  View your profile
                </span>
              </span>
              <User className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ) : (
            <Button asChild size="lg" className="w-full">
              <Link
                to="/login"
                search={{ redirect: undefined }}
                onClick={() => onOpenChange(false)}
              >
                <LogIn data-icon="inline-start" />
                Log in to AnimeKaiser
              </Link>
            </Button>
          )}

          <Separator className="my-1" />

          {links.map((link) => {
            const active = isRouteActive(pathname, link.href)

            return (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => onOpenChange(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-2xl px-3 transition active:bg-accent",
                  active && "bg-accent"
                )}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl border bg-card",
                    active && "border-primary/60 bg-primary/15 text-primary"
                  )}
                >
                  <link.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {link.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {link.description}
                  </span>
                </span>
              </Link>
            )
          })}

          <Separator className="my-1" />

          <div className="flex items-center gap-2">
            <Button variant="outline" className="flex-1" onClick={openSettings}>
              <Settings2 data-icon="inline-start" />
              Settings
            </Button>
            <ModeToggle />
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
