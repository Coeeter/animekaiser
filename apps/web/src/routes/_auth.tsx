import { Outlet, createFileRoute } from "@tanstack/react-router"
import { AuthPageLayout } from "../features/auth/auth-pages"

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <AuthPageLayout>
      <Outlet />
    </AuthPageLayout>
  )
}
