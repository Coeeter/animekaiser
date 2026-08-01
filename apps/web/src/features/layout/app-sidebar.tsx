import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@animekaiser/ui/components/avatar"
import { Button } from "@animekaiser/ui/components/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@animekaiser/ui/components/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@animekaiser/ui/components/tooltip"
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
  Search,
  Settings,
  Shuffle,
  Sparkles,
  User,
} from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { ModeToggle } from "../../components/theme"
import { searchOpenAtom } from "../anime/common/search-atoms"
import { sessionAtom } from "../auth/atoms"
import { displayUsername, userInitials } from "../auth/user"
import { settingsOpenAtom, settingsSectionAtom } from "../settings/atoms"
import { MobileNav } from "./mobile-nav"

type NavItem = { title: string; href: string; icon: LucideIcon }

const mainLinks: ReadonlyArray<NavItem> = [
  { title: "Home", href: "/", icon: Home },
  { title: "Browse", href: "/series", icon: Compass },
  { title: "Discover", href: "/discover", icon: Sparkles },
  { title: "Random", href: "/random", icon: Shuffle },
  { title: "Latest Episodes", href: "/latest-episodes", icon: Clapperboard },
]

const personalLinks: ReadonlyArray<NavItem> = [
  { title: "Profile", href: "/profile", icon: User },
  { title: "My List", href: "/my-list", icon: Bookmark },
  { title: "Watch History", href: "/watch-history", icon: History },
]

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string
  items: ReadonlyArray<NavItem>
  pathname: string
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href)
                }
                tooltip={item.title}
              >
                <Link to={item.href}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function FooterTooltip({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const { isMobile, state } = useSidebar()

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function MobileSidebarCloser({ pathname }: { pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar()

  useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, pathname, setOpenMobile])

  return null
}

export function AppSidebarProvider({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (l) => l.pathname })
  const isWatchRoute = pathname.startsWith("/watch/")
  const [open, setOpen] = useState(!isWatchRoute)
  const openBeforeWatchRef = useRef(open)
  const wasWatchRouteRef = useRef(isWatchRoute)

  useEffect(() => {
    if (isWatchRoute && !wasWatchRouteRef.current) {
      openBeforeWatchRef.current = open
      setOpen(false)
    } else if (!isWatchRoute && wasWatchRouteRef.current) {
      setOpen(openBeforeWatchRef.current)
    }

    wasWatchRouteRef.current = isWatchRoute
  }, [isWatchRoute, open])

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <MobileSidebarCloser pathname={pathname} />
      {children}
    </SidebarProvider>
  )
}

export function AppSidebar({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (l) => l.pathname })
  const isWatchRoute = pathname.startsWith("/watch/")
  const setSearchOpen = useAtomSet(searchOpenAtom)
  const setSettingsSection = useAtomSet(settingsSectionAtom)
  const setSettingsOpen = useAtomSet(settingsOpenAtom)
  const sessionResult = useAtomValue(sessionAtom)

  const user = Result.builder(sessionResult)
    .onSuccess((session) => session?.user ?? null)
    .orNull()

  const openSettings = () => {
    setSettingsSection("Account")
    setSettingsOpen(true)
  }

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="gap-3 p-3 group-data-[collapsible=icon]:items-center">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <Link
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-foreground transition-colors group-data-[collapsible=icon]:justify-center hover:text-primary"
              to="/"
            >
              <img
                className="size-8 shrink-0 rounded-xl"
                src="/logo.svg"
                alt="AnimeKaiser"
              />
              <span className="truncate font-heading text-sm font-semibold tracking-wide lowercase group-data-[collapsible=icon]:hidden">
                animekaiser
              </span>
            </Link>
            <SidebarTrigger className="hidden shrink-0 group-data-[collapsible=icon]:hidden md:inline-flex" />
          </div>
          <button
            type="button"
            className="flex h-10 w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar-accent/40 px-3 text-sm text-sidebar-foreground/70 transition-colors group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
            onClick={() => setSearchOpen(true)}
            aria-label="Open command menu"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate group-data-[collapsible=icon]:hidden">
              Search anime
            </span>
            <span className="ml-auto hidden items-center gap-1 text-[10px] tracking-[0.2em] text-sidebar-foreground/50 uppercase group-data-[collapsible=icon]:hidden md:flex">
              <span className="rounded-md border border-sidebar-border px-1.5 py-0.5">
                /
              </span>
            </span>
          </button>
        </SidebarHeader>
        <SidebarContent className="pb-4">
          <NavGroup label="Discover" items={mainLinks} pathname={pathname} />
          {user ? (
            <NavGroup
              label="Your library"
              items={personalLinks}
              pathname={pathname}
            />
          ) : null}
        </SidebarContent>
        <SidebarFooter className="border-t p-3">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
            {user ? (
              <FooterTooltip label="Profile">
                <Link
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 hover:bg-sidebar-accent"
                  to="/profile"
                >
                  <Avatar>
                    <AvatarImage
                      src={user.image ?? undefined}
                      alt={displayUsername(user)}
                    />
                    <AvatarFallback>{userInitials(user)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-medium text-sidebar-foreground">
                      {displayUsername(user)}
                    </p>
                  </div>
                </Link>
              </FooterTooltip>
            ) : (
              <>
                <Button
                  asChild
                  className="flex-1 group-data-[collapsible=icon]:order-3 group-data-[collapsible=icon]:hidden"
                >
                  <Link to="/login" search={{ redirect: undefined }}>
                    <LogIn data-icon="inline-start" />
                    Login
                  </Link>
                </Button>
                <FooterTooltip label="Login">
                  <Button
                    asChild
                    size="icon"
                    className="hidden group-data-[collapsible=icon]:order-3 group-data-[collapsible=icon]:inline-flex"
                  >
                    <Link
                      to="/login"
                      search={{ redirect: undefined }}
                      aria-label="Login"
                    >
                      <LogIn />
                    </Link>
                  </Button>
                </FooterTooltip>
              </>
            )}
            <ModeToggle />
            <FooterTooltip label="Settings">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open settings"
                onClick={openSettings}
              >
                <Settings />
              </Button>
            </FooterTooltip>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-svh bg-transparent">
        {isWatchRoute ? null : (
          <header className="sticky top-0 z-40 border-b border-white/5 bg-background/70 backdrop-blur-xl md:hidden">
            <div className="flex h-14 items-center gap-2 px-3">
              <Link to="/" className="flex shrink-0 items-center gap-2">
                <img
                  className="size-8 rounded-xl"
                  src="/logo.svg"
                  alt="AnimeKaiser"
                />
                <span className="font-heading text-sm font-semibold tracking-wide lowercase">
                  animekaiser
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search anime"
                className="ml-auto flex h-9 flex-1 items-center gap-2 overflow-hidden rounded-2xl border bg-input/40 px-3 text-sm text-muted-foreground transition active:bg-input/70"
              >
                <Search className="size-4 shrink-0" />
                <span className="truncate">Search</span>
              </button>

              {user ? (
                <Link
                  to="/profile"
                  aria-label="Your profile"
                  className="shrink-0 rounded-full"
                >
                  <Avatar className="size-8">
                    <AvatarImage
                      src={user.image ?? undefined}
                      alt={displayUsername(user)}
                    />
                    <AvatarFallback className="text-xs">
                      {userInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              ) : (
                <Button
                  asChild
                  size="sm"
                  className="shrink-0"
                  aria-label="Login"
                >
                  <Link to="/login" search={{ redirect: undefined }}>
                    <LogIn data-icon="inline-start" />
                    Login
                  </Link>
                </Button>
              )}
            </div>
          </header>
        )}
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            isWatchRoute
              ? undefined
              : "pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0"
          )}
        >
          {children}
        </div>
      </SidebarInset>
      <MobileNav />
    </>
  )
}
