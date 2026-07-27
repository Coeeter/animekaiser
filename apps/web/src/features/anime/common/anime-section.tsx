import type { AnimeItem } from "@animekaiser/domain"
import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"
import { AnimeGrid } from "./anime-grid"

export function AnimeSection({
  title,
  description,
  items,
  moreHref,
}: {
  title: string
  description?: string
  items: ReadonlyArray<AnimeItem>
  moreHref?: string
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-bold tracking-tight md:text-2xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {moreHref ? (
          <Link
            to={moreHref}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            View all
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>
      <AnimeGrid items={items} compact />
    </section>
  )
}
