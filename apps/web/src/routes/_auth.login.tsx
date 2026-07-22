import { createFileRoute } from "@tanstack/react-router"
import { LoginPage } from "../features/auth/login-page"
import { decodeLoginSearch } from "../features/auth/search"

export const Route = createFileRoute("/_auth/login")({
  staticData: { title: "Sign in" },
  validateSearch: decodeLoginSearch,
  component: LoginRoute,
})

function LoginRoute() {
  const { redirect } = Route.useSearch()
  return <LoginPage redirect={redirect} />
}
