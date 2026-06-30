import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import type { LucideIcon } from "lucide-react"
import { Compass } from "lucide-react"

export function EmptyFeaturePage({
  icon: Icon,
  kicker,
  title,
  description,
}: {
  icon: LucideIcon
  kicker: string
  title: string
  description: string
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-3xl items-center p-4 md:p-6">
      <section className="w-full">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-6" />
        </div>
        <p className="mt-4 text-xs font-semibold tracking-widest text-primary uppercase">
          {kicker}
        </p>
        <h1 className="mt-2 font-heading text-3xl font-black tracking-tight md:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <Button asChild className="mt-6">
          <Link to="/series" search={{ sort: "popularity", page: 1 }}>
            <Compass className="size-4" />
            Browse catalog
          </Link>
        </Button>
      </section>
    </div>
  )
}
