import { Button } from "@animekaiser/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@animekaiser/ui/components/empty"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { LogIn, SearchX } from "lucide-react"
import type { ReactNode } from "react"
import { settingsQueryAtom } from "./atoms"
import { matchesQuery, settingEntries } from "./settings-registry"

export function SettingCard({
  id,
  children,
  className,
}: {
  id: string
  children: ReactNode
  className?: string
}) {
  const query = useAtomValue(settingsQueryAtom)
  const entry = settingEntries.find((candidate) => candidate.id === id)

  if (entry && !matchesQuery(entry, query)) return null

  return (
    <section
      data-setting-id={id}
      className={cn(
        "rounded-2xl border bg-background/60 p-4 md:p-5",
        className
      )}
    >
      {children}
    </section>
  )
}

export function SettingHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h3 className="font-semibold">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function NoSettingsMatch({ query }: { query: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>No settings match “{query}”</EmptyTitle>
      </EmptyHeader>
    </Empty>
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
