import { useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import type { AnimeItem } from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import Autoplay from "embla-carousel-autoplay"
import useEmblaCarousel from "embla-carousel-react"
import { ChevronLeft, ChevronRight, Play, Star } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { formatAnimeFormat } from "./format"
import { animeTitlePreferenceAtom, getAnimeTitle } from "./title"

export function HeroCarousel({ items }: { items: ReadonlyArray<AnimeItem> }) {
  const preference = useAtomValue(animeTitlePreferenceAtom)
  const [selected, setSelected] = useState(0)
  const [emblaRef, embla] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 6000, stopOnInteraction: true }),
  ])
  const onSelect = useCallback(
    () => setSelected(embla?.selectedScrollSnap() ?? 0),
    [embla]
  )
  useEffect(() => {
    if (!embla) return
    onSelect()
    embla.on("select", onSelect)
    return () => {
      embla.off("select", onSelect)
    }
  }, [embla, onSelect])

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-muted">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {items.map((anime) => {
            const image = anime.bannerImage ?? anime.coverImage
            return (
              <div
                key={anime.malId}
                className="relative min-w-0 shrink-0 grow-0 basis-full"
              >
                <Link
                  to="/series/$id"
                  params={{ id: anime.malId }}
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
                  <div className="absolute inset-x-0 bottom-0 flex items-end gap-5 p-4 sm:p-6 md:p-8">
                    {anime.coverImage ? (
                      <img
                        src={anime.coverImage}
                        alt=""
                        className="hidden aspect-2/3 w-28 rounded-lg object-cover shadow-lg sm:block md:w-36"
                      />
                    ) : null}
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex gap-1.5">
                        {anime.averageScore !== null ? (
                          <Badge className="gap-1 border-0 bg-white/15 text-white">
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                            {anime.averageScore}%
                          </Badge>
                        ) : null}
                        {anime.format ? (
                          <Badge className="border-0 bg-white/15 text-white">
                            {formatAnimeFormat(anime.format)}
                          </Badge>
                        ) : null}
                      </div>
                      <h2 className="max-w-lg font-heading text-xl leading-tight font-bold text-white sm:text-2xl md:text-3xl">
                        {getAnimeTitle(anime.title, preference)}
                      </h2>
                      <div className="flex flex-wrap gap-1.5">
                        {anime.genres.slice(0, 3).map((genre) => (
                          <span
                            key={genre}
                            className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/80"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                      <div className="pt-1">
                        <Button
                          size="sm"
                          className="pointer-events-none bg-primary/80"
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
      <div className="absolute right-4 bottom-4 flex items-center gap-2 sm:right-6 sm:bottom-6">
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white"
          onClick={() => embla?.scrollPrev()}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white"
          onClick={() => embla?.scrollNext()}
        >
          <ChevronRight />
        </Button>
        <div className="ml-1 flex gap-1.5">
          {items.map((anime, index) => (
            <button
              key={anime.malId}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              className={`h-1.5 rounded-full transition-all ${selected === index ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
              onClick={() => embla?.scrollTo(index)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
