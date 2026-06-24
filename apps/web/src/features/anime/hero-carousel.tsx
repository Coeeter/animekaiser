import { useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import type { AnimeItem } from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import Autoplay from "embla-carousel-autoplay"
import useEmblaCarousel from "embla-carousel-react"
import { ChevronLeft, ChevronRight, Play, Star } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { formatAnimeFormat } from "./format"
import { animeTitlePreferenceAtom, getAnimeTitle } from "./title"

export function HeroCarousel({ items }: { items: ReadonlyArray<AnimeItem> }) {
  const titlePreference = useAtomValue(animeTitlePreferenceAtom)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 6000, stopOnInteraction: true }),
  ])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on("select", onSelect)
    return () => {
      emblaApi.off("select", onSelect)
    }
  }, [emblaApi, onSelect])

  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi]
  )

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-muted">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {items.map((anime) => {
            const title = getAnimeTitle(anime.title, titlePreference)
            const image = anime.bannerImage ?? anime.coverImage

            return (
              <div
                key={anime.malId}
                className="relative min-w-0 shrink-0 grow-0 basis-full"
              >
                <Link
                  to="/series/$id"
                  params={{ id: anime.malId }}
                  preload="intent"
                  className="group block"
                >
                  <div className="relative aspect-[4/3] sm:aspect-[2.5/1] md:aspect-[3/1]">
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        className="size-full object-cover transition duration-700 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="size-full bg-muted" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
                  </div>

                  <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-4 sm:gap-5 sm:p-6 md:p-8">
                    {anime.coverImage ? (
                      <img
                        src={anime.coverImage}
                        alt=""
                        className="hidden aspect-2/3 w-28 shrink-0 rounded-lg object-cover shadow-lg ring-1 ring-white/10 sm:block md:w-36"
                      />
                    ) : null}
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:gap-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {anime.averageScore ? (
                          <Badge className="gap-1 border-0 bg-white/15 text-white backdrop-blur-sm">
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                            {anime.averageScore}%
                          </Badge>
                        ) : null}
                        {anime.format ? (
                          <Badge className="border-0 bg-white/15 text-white backdrop-blur-sm">
                            {formatAnimeFormat(anime.format)}
                          </Badge>
                        ) : null}
                      </div>
                      <h2 className="max-w-lg font-heading text-xl leading-tight font-bold tracking-tight text-white sm:text-2xl md:text-3xl">
                        {title}
                      </h2>
                      <div className="flex flex-wrap gap-1.5">
                        {anime.genres.slice(0, 3).map((genre) => (
                          <span
                            key={genre}
                            className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/80 backdrop-blur-sm"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                      <div className="pt-1">
                        <Button
                          size="sm"
                          className="pointer-events-none bg-primary/80 backdrop-blur-sm"
                        >
                          <Play className="size-3.5 fill-current" />
                          View details
                        </Button>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      </div>

      <div className="absolute right-4 bottom-4 flex items-center gap-2 sm:right-6 sm:bottom-6 md:right-8 md:bottom-8">
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 hover:text-white"
          onClick={() => emblaApi?.scrollPrev()}
        >
          <ChevronLeft />
          <span className="sr-only">Previous</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 hover:text-white"
          onClick={() => emblaApi?.scrollNext()}
        >
          <ChevronRight />
          <span className="sr-only">Next</span>
        </Button>
        <div className="ml-1 flex items-center gap-1.5">
          {items.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === selectedIndex
                  ? "w-6 bg-white"
                  : "w-1.5 bg-white/40 hover:bg-white/60"
              )}
              onClick={() => scrollTo(index)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
