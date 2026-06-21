import {
  Link,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@workspace/ui/components/command"
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
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { authClient, displayUsername, userInitials } from "../auth"
import type { AppSession } from "../auth.functions"
import { SettingsDialog } from "../features/settings/settings"
import type { SettingsSection } from "../features/settings/settings"
import { ModeToggle } from "./theme"

type NavItem = { title: string; href: string; icon: LucideIcon }
const mainLinks: NavItem[] = [
  { title: "Home", href: "/", icon: Home },
  { title: "Browse", href: "/series", icon: Compass },
  { title: "Discover", href: "/discover", icon: Sparkles },
  { title: "Random", href: "/random", icon: Shuffle },
  { title: "Latest Episodes", href: "/latest-episodes", icon: Clapperboard },
  { title: "Schedule", href: "/schedule", icon: CalendarDays },
]
const personalLinks: NavItem[] = [
  { title: "Profile", href: "/profile", icon: User },
  { title: "My List", href: "/my-list", icon: Bookmark },
  { title: "Watch History", href: "/watch-history", icon: History },
]
const authRoutes = new Set(["/login", "/register", "/forgot-password"])

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string
  items: NavItem[]
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

function MobileSidebarCloser({ pathname }: { pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar()
  useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, pathname, setOpenMobile])
  return null
}

function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search anime"
      description="Anime search has not been migrated yet."
    >
      <Command>
        <CommandInput placeholder="Search anime…" />
        <CommandList>
          <CommandEmpty>Anime search has not been migrated yet.</CommandEmpty>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

export function AppShell({
  children,
  session,
}: {
  children: ReactNode
  session: AppSession
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const navigate = useNavigate()
  const router = useRouter()
  const user = session?.user ?? null
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [requestedSection, setRequestedSection] =
    useState<SettingsSection | null>(null)
  const [logoutPending, setLogoutPending] = useState(false)

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target
      const editing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      if (
        event.key === "/" &&
        !editing &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", keydown)
    return () => window.removeEventListener("keydown", keydown)
  }, [])

  useEffect(() => {
    const open = (event: Event) => {
      const section = (event as CustomEvent<SettingsSection>).detail
      setRequestedSection(section)
      setSettingsOpen(true)
    }
    window.addEventListener("kaiser:settings", open)
    return () => window.removeEventListener("kaiser:settings", open)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("oauth_result") !== "connected") return
    const provider =
      params.get("oauth_provider") === "mal" ? "MyAnimeList" : "AniList"
    toast.success(`${provider} connected.`)
    setRequestedSection("Integrations")
    setSettingsOpen(true)
    params.delete("oauth_result")
    params.delete("oauth_provider")
    const query = params.toString()
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`
    )
  }, [])

  const logout = async () => {
    setLogoutPending(true)
    try {
      const result = await authClient.signOut()
      if (result.error) throw result.error
      setSettingsOpen(false)
      await router.invalidate()
      await navigate({ to: "/" })
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Unable to sign out"
      )
    } finally {
      setLogoutPending(false)
    }
  }

  if (authRoutes.has(pathname)) return children

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 left-[20%] size-96 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[8%] bottom-[-10rem] size-96 rounded-full bg-chart-2/10 blur-3xl" />
      </div>
      <SidebarProvider>
        <MobileSidebarCloser pathname={pathname} />
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
              onClick={() => setSearchOpen(true)}
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
            {user ? (
              <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
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
                <ModeToggle />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open settings"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings2 />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
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
                <ModeToggle />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open settings"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings2 />
                </Button>
              </div>
            )}
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
                onClick={() => setSettingsOpen(true)}
              >
                <Settings2 />
              </Button>
            </div>
          </header>
          <div className="flex-1">{children}</div>
        </SidebarInset>
        <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          requestedSection={requestedSection}
          user={user}
          onLogout={() => void logout()}
          logoutPending={logoutPending}
        />
      </SidebarProvider>
    </>
  )
}
