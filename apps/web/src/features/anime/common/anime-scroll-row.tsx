import type { AnimeItem } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { cn } from "@animekaiser/ui/lib/utils"
import { Link } from "@tanstack/react-router"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { AnimeCard } from "./anime-card"

export type RowLink = {
  to: string
  search?: Record<string, unknown>
}

export function AnimeScrollRow({
  title,
  eyebrow,
  items,
  more,
}: {
  title: string
  eyebrow?: string
  items: ReadonlyArray<AnimeItem>
  more?: RowLink
}) {
  if (items.length === 0) return null

  return (
    <MediaRow title={title} eyebrow={eyebrow} more={more}>
      {items.map((anime) => (
        <div
          key={anime.malId}
          className="w-32 shrink-0 sm:w-36 md:w-40 lg:w-44"
        >
          <AnimeCard anime={anime} compact />
        </div>
      ))}
    </MediaRow>
  )
}

export function MediaRow({
  title,
  eyebrow,
  more,
  children,
}: {
  title: string
  eyebrow?: string
  more?: RowLink
  children: ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const element = scrollRef.current
    if (!element) return
    setCanScrollLeft(element.scrollLeft > 4)
    setCanScrollRight(
      element.scrollLeft < element.scrollWidth - element.clientWidth - 4
    )
  }, [])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    checkScroll()
    element.addEventListener("scroll", checkScroll, { passive: true })
    const observer = new ResizeObserver(checkScroll)
    observer.observe(element)
    return () => {
      element.removeEventListener("scroll", checkScroll)
      observer.disconnect()
    }
  }, [checkScroll])

  const scroll = (direction: "left" | "right") => {
    const element = scrollRef.current
    if (!element) return
    const distance = Math.max(element.clientWidth - 96, 200)
    element.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    })
  }

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="font-heading text-lg font-bold tracking-tight md:text-xl">
            {title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden md:inline-flex"
            disabled={!canScrollLeft}
            onClick={() => scroll("left")}
          >
            <ChevronLeft />
            <span className="sr-only">Scroll left</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden md:inline-flex"
            disabled={!canScrollRight}
            onClick={() => scroll("right")}
          >
            <ChevronRight />
            <span className="sr-only">Scroll right</span>
          </Button>
          {more ? (
            <Link
              to={more.to}
              search={more.search as never}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              View all
              <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="relative min-w-0">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent transition-opacity",
            canScrollLeft ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent transition-opacity",
            canScrollRight ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          ref={scrollRef}
          className="no-scrollbar snap-row flex gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 md:gap-4"
        >
          {children}
        </div>
      </div>
    </section>
  )
}
