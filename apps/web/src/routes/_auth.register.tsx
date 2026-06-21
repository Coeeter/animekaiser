import { createFileRoute } from "@tanstack/react-router"
import { RegisterPage } from "../features/auth/auth-pages"

export const Route = createFileRoute("/_auth/register")({
  component: RegisterPage,
})
