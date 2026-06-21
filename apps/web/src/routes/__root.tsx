import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { Toaster } from "@workspace/ui/components/sonner"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { getAppSession } from "../lib/session"
import { AppShell } from "../components/app-shell"
import { ThemeProvider } from "../components/theme"

import appCss from "@workspace/ui/globals.css?url"

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
      {
        title: "AnimeKaiser",
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
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const session = Route.useLoaderData()
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="overflow-x-hidden">
        <ThemeProvider>
          <TooltipProvider>
            <AppShell session={session}>{children}</AppShell>
          </TooltipProvider>
          <Toaster richColors />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
