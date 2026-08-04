import { Toaster } from "@animekaiser/ui/components/sonner"
import { TooltipProvider } from "@animekaiser/ui/components/tooltip"
import { useAtomMount } from "@effect-atom/atom-react"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import { DocumentTitle } from "../components/document-title"
import { RouteErrorPage } from "../components/route-error-page"
import { ThemeProvider } from "../components/theme"
import { AppShell } from "../features/layout/app-shell"
import { streamProvidersAtom } from "../features/streaming/atoms"
import "../styles/globals.css"

export const Route = createRootRoute({
  errorComponent: RouteErrorPage,
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  component: RootRouteComponent,
  shellComponent: RootDocument,
})

function RootRouteComponent() {
  // The configured provider list is fixed for the lifetime of the app; fetching
  // it here keeps it warm before any page needs it.
  useAtomMount(streamProvidersAtom)

  return (
    <>
      <DocumentTitle />
      <AppShell>
        <Outlet />
      </AppShell>
    </>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster position="top-center" richColors />
    </ThemeProvider>
  )
}
