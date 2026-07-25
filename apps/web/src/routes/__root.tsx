import { createRootRoute, Outlet } from "@tanstack/react-router"
import { Toaster } from "@workspace/ui/components/sonner"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { DocumentTitle } from "../components/document-title"
import { ThemeProvider } from "../components/theme"
import { AppShell } from "../features/layout/app-shell"
import { getAppSession } from "../lib/session"
import "../styles/globals.css"

export const Route = createRootRoute({
  loader: () => getAppSession(),
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
  const session = Route.useLoaderData()
  return (
    <>
      <DocumentTitle />
      <AppShell session={session}>
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
