import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import type { LucideIcon } from "lucide-react"

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
    <main className="mx-auto flex min-h-[75svh] w-full max-w-5xl items-center justify-center p-6">
      <div className="relative w-full overflow-hidden rounded-3xl border bg-card/70 px-6 py-20 text-center shadow-sm backdrop-blur-xl">
        <div className="absolute inset-x-1/4 top-0 h-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto flex max-w-xl flex-col items-center">
          <div className="mb-6 grid size-16 place-items-center rounded-2xl border bg-background shadow-sm">
            <Icon className="size-7 text-primary" />
          </div>
          <p className="text-sm font-semibold text-primary">{kicker}</p>
          <h1 className="mt-3 font-heading text-4xl font-black tracking-tight">
            {title}
          </h1>
          <p className="mt-4 leading-7 text-muted-foreground">{description}</p>
          <Button asChild className="mt-8">
            <Link to="/series" search={{ page: 1, sort: "popularity" }}>
              Browse anime
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
