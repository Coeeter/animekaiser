import { createFileRoute } from "@tanstack/react-router"
import { RegisterPage } from "../features/auth/register-page"

export const Route = createFileRoute("/_auth/register")({
  staticData: { title: "Create account" },
  component: RegisterPage,
})
