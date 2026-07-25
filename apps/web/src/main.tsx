import { RegistryProvider } from "@effect-atom/atom-react"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { routeTree } from "./routeTree.gen"
import "./styles/globals.css"

const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
  interface StaticDataRouteOption {
    readonly title?: string
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RegistryProvider defaultIdleTTL={30 * 60 * 1000}>
      <RouterProvider router={router} />
    </RegistryProvider>
  </StrictMode>
)
