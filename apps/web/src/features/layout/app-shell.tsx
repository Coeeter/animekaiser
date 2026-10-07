import {
  RegistryContext,
  Result,
  useAtomMount,
  useAtomRefresh,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Navigate, useLocation } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { useContext } from "react"
import { DataError } from "../../components/data-error"
import {
  rpcConnectionRecoveryAtom,
  rpcConnectionStatusAtom,
} from "../../services/api-clients"
import { SearchDialog } from "../anime/common/search-dialog"
import { isProtectedRoute, sessionAtom } from "../auth/atoms"
import { ownProfileAtom } from "../profile/atoms"
import { preferencesSyncAtom } from "../settings/preferences-sync"
import { SettingsDialog } from "../settings/settings-dialog"
import { PlaybackSessionHost } from "../streaming/playback-session"
import { AppSidebar, AppSidebarProvider } from "./app-sidebar"

const onboardingRoute = "/welcome"

const bareRoutes = new Set([
  "/login",
  "/register",
  "/forgot-password",
  onboardingRoute,
])

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()

  const sessionResult = useAtomValue(sessionAtom)
  const refreshSession = useAtomRefresh(sessionAtom)
  const profileResult = useAtomValue(ownProfileAtom)

  const needsOnboarding = Result.builder(profileResult)
    .onSuccess((profile) => !profile.profile.onboarded)
    .orElse(() => false)

  if (bareRoutes.has(location.pathname)) return children

  if (location.pathname !== onboardingRoute && needsOnboarding)
    return <Navigate to="/welcome" search={{ step: "username" }} replace />

  if (isProtectedRoute(location.pathname)) {
    const element = Result.builder(sessionResult)
      .onInitialOrWaiting(() => <div className="min-h-svh" />)
      .onFailure(() => (
        <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
          <DataError
            title="Unable to check your session"
            onRetry={refreshSession}
          />
        </div>
      ))
      .onSuccess((value) => {
        if (!value)
          return (
            <Navigate
              to="/login"
              search={{ redirect: location.href }}
              replace
            />
          )

        return null
      })
      .render()

    if (element) return element
  }

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[56rem] backdrop-glow"
      />
      <AppSidebarProvider>
        <AppSidebar>{children}</AppSidebar>
        <SearchDialog />
        <SettingsDialog />
        <PlaybackSessionHost />
        <RpcConnectionMonitor />
      </AppSidebarProvider>
    </>
  )
}

function RpcConnectionMonitor() {
  const registry = useContext(RegistryContext)
  const status = useAtomValue(rpcConnectionStatusAtom)

  useAtomMount(rpcConnectionRecoveryAtom(registry))
  useAtomMount(preferencesSyncAtom)

  if (status === "connected") return null

  return (
    <div
      aria-live="polite"
      role="status"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm shadow-lg"
    >
      <Loader2 className="size-4 animate-spin" />
      Reconnecting…
    </div>
  )
}
