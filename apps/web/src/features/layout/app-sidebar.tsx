import { Link } from "@tanstack/react-router"
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
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@workspace/ui/components/sidebar"
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
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect } from "react"
import type { AppUser } from "../../lib/auth-client"
import { displayUsername, userInitials } from "../../lib/auth-client"
import { ModeToggle } from "../../components/theme"

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
                <a href={item.href}>
                  <item.icon />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function MobileSidebarCloser({ pathname }: { pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar()
  useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, pathname, setOpenMobile])
  return null
}

export function AppSidebar({
  children,
  pathname,
  user,
  onSearch,
  onSettings,
}: {
  children: ReactNode
  pathname: string
  user: AppUser | null
  onSearch: () => void
  onSettings: () => void
}) {
  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="gap-3 p-3">
          <div className="flex items-center gap-2">
            <Link
              className="flex min-w-0 flex-1 items-center gap-3 group-data-[collapsible=icon]:justify-center"
              to="/"
            >
              <img className="size-8 rounded-xl" src="/logo.svg" alt="" />
              <span className="truncate font-heading text-sm font-semibold group-data-[collapsible=icon]:hidden">
                animekaiser
              </span>
            </Link>
            <SidebarTrigger className="hidden group-data-[collapsible=icon]:hidden md:inline-flex" />
          </div>
          <button
            type="button"
            className="flex h-10 items-center gap-3 rounded-2xl border bg-sidebar-accent/40 px-3 text-sm text-sidebar-foreground/70 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:px-0 hover:bg-sidebar-accent"
            onClick={onSearch}
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate group-data-[collapsible=icon]:hidden">
              Search anime
            </span>
            <span className="ml-auto text-xs group-data-[collapsible=icon]:hidden">
              /
            </span>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <NavGroup label="Main" items={mainLinks} pathname={pathname} />
          {user ? (
            <NavGroup
              label="Personal"
              items={personalLinks}
              pathname={pathname}
            />
          ) : null}
        </SidebarContent>
        <SidebarFooter className="border-t p-3">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
            {user ? (
              <a
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-2 group-data-[collapsible=icon]:p-0 hover:bg-sidebar-accent"
                href="/profile"
              >
                <Avatar>
                  <AvatarImage
                    src={user.image ?? undefined}
                    alt={displayUsername(user)}
                  />
                  <AvatarFallback>{userInitials(user)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-medium">
                    {displayUsername(user)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Logged in
                  </p>
                </div>
              </a>
            ) : (
              <Button
                asChild
                className="flex-1 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:px-0"
              >
                <Link to="/login" search={{ redirect: undefined }}>
                  <LogIn data-icon="inline-start" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Login
                  </span>
                </Link>
              </Button>
            )}
            <ModeToggle />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open settings"
              onClick={onSettings}
            >
              <Settings2 />
            </Button>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-svh bg-background/65 backdrop-blur-xl">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/75 px-3 backdrop-blur-xl md:hidden">
          <SidebarTrigger />
          <Link to="/">
            <img
              className="size-8 rounded-xl"
              src="/logo.svg"
              alt="AnimeKaiser"
            />
          </Link>
          <div className="flex items-center gap-1">
            <ModeToggle />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open settings"
              onClick={onSettings}
            >
              <Settings2 />
            </Button>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </>
  )
}
