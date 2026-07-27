import type { AnimeItem } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { cn } from "@animekaiser/ui/lib/utils"
import { Link } from "@tanstack/react-router"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { AnimeCard } from "./anime-card"

export function AnimeScrollRow({
  title,
  items,
  moreHref,
}: {
  title: string
  items: ReadonlyArray<AnimeItem>
  moreHref?: string
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
    const cardWidth =
      element.querySelector('[data-slot="scroll-card"]')?.clientWidth ?? 200
    const distance = cardWidth * 3
    element.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    })
  }

  if (items.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-xl font-bold tracking-tight">
          {title}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden sm:inline-flex"
            disabled={!canScrollLeft}
            onClick={() => scroll("left")}
          >
            <ChevronLeft />
            <span className="sr-only">Scroll left</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden sm:inline-flex"
            disabled={!canScrollRight}
            onClick={() => scroll("right")}
          >
            <ChevronRight />
            <span className="sr-only">Scroll right</span>
          </Button>
          {moreHref ? (
            <Link
              to={moreHref}
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              View all
              <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="relative">
        {canScrollLeft ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
        ) : null}
        {canScrollRight ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
        ) : null}

        <div
          ref={scrollRef}
          className={cn(
            "flex gap-4 overflow-x-auto scroll-smooth pb-2",
            "[scrollbar-width:none] scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          )}
        >
          {items.map((anime) => (
            <div
              key={anime.malId}
              data-slot="scroll-card"
              className="w-36 shrink-0 sm:w-40 md:w-44"
            >
              <AnimeCard anime={anime} compact />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
