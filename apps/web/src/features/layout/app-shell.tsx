import { Result, useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Navigate, useLocation } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { DataError } from "../../components/data-error"
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
        <DataError
          title="Unable to check your session"
          onRetry={refreshSession}
        />
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
      </AppSidebarProvider>
    </>
  )
}
