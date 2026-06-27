import { useAtomSet } from "@effect-atom/atom-react"
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router"
import { SidebarProvider } from "@workspace/ui/components/sidebar"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { authClient } from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import type { AppSession } from "../../lib/session"
import { SearchDialog } from "../anime/search-dialog"
import { animeTitlePreferenceAtom } from "../anime/title"
import { SettingsDialog, SettingsSection } from "../settings/settings-dialog"
import {
  playerPreferencesAtom,
  playerPreferencesStorageKey,
  readStoredPlayerPreferences,
} from "../streaming/preferences"
import { AppSidebar, MobileSidebarCloser } from "./app-sidebar"

const authRoutes = new Set(["/login", "/register", "/forgot-password"])

export function AppShell({
  children,
  session,
}: {
  children: ReactNode
  session: AppSession | null
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
  const isWatchRoute = pathname.startsWith("/watch/")
  const [sidebarOpen, setSidebarOpen] = useState(!isWatchRoute)
  const setTitlePreference = useAtomSet(animeTitlePreferenceAtom)
  const setPlayerPreferences = useAtomSet(playerPreferencesAtom)

  useEffect(() => {
    Schema.decodeUnknownOption(Schema.Literal("english", "romaji"))(
      window.localStorage.getItem("anime-title-preference")
    ).pipe(Option.map(setTitlePreference))
    setPlayerPreferences(
      readStoredPlayerPreferences(
        window.localStorage.getItem(playerPreferencesStorageKey)
      )
    )
  }, [setPlayerPreferences, setTitlePreference])

  useEffect(() => {
    if (isWatchRoute) setSidebarOpen(false)
  }, [isWatchRoute])

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
      const detail = event instanceof CustomEvent ? event.detail : null
      Schema.decodeUnknownOption(SettingsSection)(detail).pipe(
        Option.map(setRequestedSection)
      )
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
    } catch (cause) {
      toast.error(errorMessage(cause, "Unable to sign out"))
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
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <MobileSidebarCloser pathname={pathname} />
        <AppSidebar
          pathname={pathname}
          user={user}
          onSearch={() => setSearchOpen(true)}
          onSettings={() => setSettingsOpen(true)}
        >
          {children}
        </AppSidebar>
        <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          requestedSection={requestedSection}
          session={session}
          onLogout={() => void logout()}
          logoutPending={logoutPending}
        />
      </SidebarProvider>
    </>
  )
}
