import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Link, useLocation } from "@tanstack/react-router"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
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
} from "@workspace/ui/components/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import type { LucideIcon } from "lucide-react"
import {
  Bookmark,
  CalendarDays,
  Clapperboard,
  Compass,
  History,
  Home,
  LogIn,
  Search,
  Settings2,
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

type NavItem = { title: string; href: string; icon: LucideIcon }

const mainLinks: ReadonlyArray<NavItem> = [
  { title: "Home", href: "/", icon: Home },
  { title: "Browse", href: "/series", icon: Compass },
  { title: "Discover", href: "/discover", icon: Sparkles },
  { title: "Random", href: "/random", icon: Shuffle },
  { title: "Latest Episodes", href: "/latest-episodes", icon: Clapperboard },
  { title: "Schedule", href: "/schedule", icon: CalendarDays },
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
          <NavGroup label="Main Group" items={mainLinks} pathname={pathname} />
          {user ? (
            <NavGroup
              label="Personal Group"
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
                <Settings2 />
              </Button>
            </FooterTooltip>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-svh bg-background/55 backdrop-blur-xl">
        <header className="fixed inset-x-0 top-0 z-40 border-b bg-background/70 backdrop-blur-xl md:hidden">
          <div className="relative flex h-16 items-center justify-between px-3">
            <div className="flex items-center gap-1">
              <SidebarTrigger />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
                aria-label="Open command menu"
              >
                <Search />
              </Button>
            </div>

            <Link
              to="/"
              className="absolute left-1/2 -translate-x-1/2 rounded-2xl"
            >
              <img
                className="size-8 rounded-xl"
                src="/logo.svg"
                alt="AnimeKaiser"
              />
            </Link>

            <div className="flex items-center gap-1">
              <ModeToggle />
              {!user ? (
                <Button asChild variant="ghost" size="icon" aria-label="Login">
                  <Link to="/login" search={{ redirect: undefined }}>
                    <LogIn />
                  </Link>
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open settings"
                onClick={openSettings}
              >
                <Settings2 />
              </Button>
            </div>
          </div>
        </header>
        <div className="flex-1 px-4 pt-20 pb-6 md:px-6 md:pt-6">{children}</div>
      </SidebarInset>
    </>
  )
}
