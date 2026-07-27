import { Button } from "@animekaiser/ui/components/button"
import { Spinner } from "@animekaiser/ui/components/spinner"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean
  children: ReactNode
}) {
  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? <Spinner data-icon="inline-start" /> : null}
      {children}
    </Button>
  )
}

export function AuthFooter({
  prompt,
  action,
  to,
}: {
  prompt: string
  action: string
  to: string
}) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      {prompt}{" "}
      <Link
        className="font-medium text-foreground underline-offset-4 hover:underline"
        to={to}
      >
        {action}
      </Link>
    </p>
  )
}
