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
import { SettingsDialog } from "../settings/settings-dialog"
import { PlaybackSessionHost } from "../streaming/playback-session"
import { AppSidebar, AppSidebarProvider } from "./app-sidebar"

const authRoutes = new Set(["/login", "/register", "/forgot-password"])

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()

  const sessionResult = useAtomValue(sessionAtom)
  const refreshSession = useAtomRefresh(sessionAtom)

  if (authRoutes.has(location.pathname)) return children

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
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 left-[20%] size-96 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[8%] -bottom-40 size-96 rounded-full bg-chart-2/10 blur-3xl" />
      </div>
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
