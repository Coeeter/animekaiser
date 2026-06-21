import { Link } from "@tanstack/react-router"
import type { AnimeItem } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
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
  const [scrollable, setScrollable] = useState({ left: false, right: false })
  const checkScroll = useCallback(() => {
    const element = scrollRef.current
    if (!element) return
    setScrollable({
      left: element.scrollLeft > 4,
      right: element.scrollLeft < element.scrollWidth - element.clientWidth - 4,
    })
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

  if (items.length === 0) return null
  const scroll = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: direction * 560, behavior: "smooth" })
  }

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
            disabled={!scrollable.left}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft />
            <span className="sr-only">Scroll left</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden sm:inline-flex"
            disabled={!scrollable.right}
            onClick={() => scroll(1)}
          >
            <ChevronRight />
            <span className="sr-only">Scroll right</span>
          </Button>
          {moreHref ? (
            <Link
              to={moreHref}
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              View all <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex [scrollbar-width:none] gap-4 overflow-x-auto scroll-smooth pb-2 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((anime) => (
          <div key={anime.malId} className="w-36 shrink-0 sm:w-40 md:w-44">
            <AnimeCard anime={anime} compact />
          </div>
        ))}
      </div>
    </section>
  )
}
