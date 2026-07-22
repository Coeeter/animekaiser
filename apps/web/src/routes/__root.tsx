import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router"
import { Toaster } from "@workspace/ui/components/sonner"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { DocumentTitle } from "../components/document-title"
import { ThemeProvider } from "../components/theme"
import { AppShell } from "../features/layout/app-shell"
import { getAppSession } from "../lib/session"

import appCss from "../styles/globals.css?url"

export const Route = createRootRoute({
  loader: () => getAppSession(),
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/logo.svg" },
    ],
  }),
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="overflow-x-hidden">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-center" richColors />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
