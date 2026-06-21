import { createFileRoute } from "@tanstack/react-router"
import { LoginPage } from "../features/auth/auth-pages"
import { decodeLoginSearch } from "../features/auth/search"

export const Route = createFileRoute("/_auth/login")({
  validateSearch: decodeLoginSearch,
  component: LoginRoute,
})

function LoginRoute() {
  const { redirect } = Route.useSearch()
  return <LoginPage redirect={redirect} />
}
