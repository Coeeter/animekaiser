import { cn } from "@workspace/ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

function PageHero({
  icon: Icon,
  kicker,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon
  kicker: string
  title: string
  description: string
  children?: ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Icon className="size-4" />
        <span>{kicker}</span>
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-black tracking-tight md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        {children ? <div className="shrink-0">{children}</div> : null}
      </div>
    </header>
  )
}

export { PageHero }
