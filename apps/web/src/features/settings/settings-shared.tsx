import { Button } from "@animekaiser/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@animekaiser/ui/components/empty"
import { cn } from "@animekaiser/ui/lib/utils"
import { Link } from "@tanstack/react-router"
import { LogIn } from "lucide-react"
import type { ReactNode } from "react"

export function PanelCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-background/60 p-4 md:p-5",
        className
      )}
    >
      {children}
    </section>
  )
}

export function AuthRequired() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LogIn />
        </EmptyMedia>
        <EmptyTitle>Login required</EmptyTitle>
        <EmptyDescription>
          Sign in to manage this part of your account.
        </EmptyDescription>
      </EmptyHeader>
      <Button asChild>
        <Link to="/login" search={{ redirect: undefined }}>
          Login
        </Link>
      </Button>
    </Empty>
  )
}
