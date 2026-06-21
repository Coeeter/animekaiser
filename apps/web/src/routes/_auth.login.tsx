import { createFileRoute } from "@tanstack/react-router"
import { LoginPage } from "../features/auth/auth-pages"

export const Route = createFileRoute("/_auth/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginRoute,
})

function LoginRoute() {
  const { redirect } = Route.useSearch()
  return <LoginPage redirect={redirect} />
}
