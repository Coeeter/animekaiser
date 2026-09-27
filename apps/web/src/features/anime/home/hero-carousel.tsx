import type { AnimeHeroItem } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import Autoplay from "embla-carousel-autoplay"
import useEmblaCarousel from "embla-carousel-react"
import { ChevronLeft, ChevronRight, Info, Play, Star } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { formatAnimeFormat, formatAnimeStatus } from "../common/format"
import { animeTitlePreferenceAtom, getAnimeTitle } from "../common/title"

export function HeroCarousel({
  items,
}: {
  items: ReadonlyArray<AnimeHeroItem>
}) {
  const titlePreference = useAtomValue(animeTitlePreferenceAtom)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 8000, stopOnInteraction: false, stopOnMouseEnter: true }),
  ])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
    // Every slide change, manual or automatic, gets a full delay before the
    // next auto-advance, so a click never lands just before a scheduled swipe.
    emblaApi.plugins().autoplay?.reset()
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on("select", onSelect)
    emblaApi.on("reInit", onSelect)
    return () => {
      emblaApi.off("select", onSelect)
      emblaApi.off("reInit", onSelect)
    }
  }, [emblaApi, onSelect])

  if (items.length === 0) return null

  return (
    <section aria-label="Trending now" className="relative isolate">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {items.map((anime, index) => (
            <HeroSlide
              key={anime.malId}
              anime={anime}
              rank={index + 1}
              title={getAnimeTitle(anime.title, titlePreference)}
            />
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 mx-auto hidden max-w-7xl items-center justify-end gap-4 px-6 pb-6 md:flex">
        <div className="pointer-events-auto flex items-center gap-1">
          {items.map((anime, index) => (
            <button
              key={anime.malId}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === selectedIndex ? "true" : undefined}
              className="group/dot flex h-6 items-center px-0.5"
              onClick={() => emblaApi?.scrollTo(index)}
            >
              <span
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  index === selectedIndex
                    ? "w-8 bg-primary"
                    : "w-3 bg-foreground/25 group-hover/dot:bg-foreground/50"
                )}
              />
            </button>
          ))}
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full bg-background/40 backdrop-blur-sm"
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft />
            <span className="sr-only">Previous</span>
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full bg-background/40 backdrop-blur-sm"
            onClick={() => emblaApi?.scrollNext()}
          >
            <ChevronRight />
            <span className="sr-only">Next</span>
          </Button>
        </div>
      </div>

      <div className="flex justify-center gap-1.5 pt-4 md:hidden">
        {items.map((anime, index) => (
          <button
            key={anime.malId}
            type="button"
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === selectedIndex ? "true" : undefined}
            className="flex h-4 items-center"
            onClick={() => emblaApi?.scrollTo(index)}
          >
            <span
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                index === selectedIndex
                  ? "w-6 bg-primary"
                  : "w-1.5 bg-foreground/25"
              )}
            />
          </button>
        ))}
      </div>
    </section>
  )
}

function HeroSlide({
  anime,
  rank,
  title,
}: {
  anime: AnimeHeroItem
  rank: number
  title: string
}) {
  const image = anime.backdrop ?? anime.bannerImage ?? anime.coverImage
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null

  const meta = [
    formatAnimeFormat(anime.format),
    anime.seasonYear ? String(anime.seasonYear) : null,
    anime.episodes ? `${anime.episodes} episodes` : null,
    formatAnimeStatus(anime.status),
  ].filter(Boolean)

  return (
    <div className="relative min-w-0 shrink-0 grow-0 basis-full">
      <div className="relative aspect-video w-full overflow-hidden md:aspect-auto md:h-[min(72vh,620px)] md:min-h-[460px]">
        {image ? (
          <img
            src={image}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 size-full object-cover object-top"
            loading={rank === 1 ? "eager" : "lazy"}
            fetchPriority={rank === 1 ? "high" : "auto"}
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 bg-muted" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-background via-background/75 to-transparent md:block md:w-3/4" />
      </div>

      <div className="relative z-10 mx-auto -mt-10 w-full max-w-7xl px-4 md:absolute md:inset-0 md:mt-0 md:flex md:items-center md:px-6">
        <div className="flex max-w-xl flex-col gap-3 md:gap-4 md:pb-10">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            #{rank} Trending
          </p>

          <h2 className="line-clamp-2 font-heading text-3xl leading-[1.05] font-black tracking-tight text-foreground md:text-5xl">
            <Link
              to="/series/$id"
              params={{ id: anime.malId }}
              preload="intent"
              className="hover:text-primary"
            >
              {title}
            </Link>
          </h2>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {score ? (
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                {score}
              </span>
            ) : null}
            {meta.map((entry) => (
              <span key={entry}>{entry}</span>
            ))}
          </div>

          {anime.description ? (
            <p className="line-clamp-2 text-sm leading-relaxed text-foreground/75 md:line-clamp-3 md:text-base">
              {anime.description}
            </p>
          ) : null}

          {anime.genres.length > 0 ? (
            <div className="hidden flex-wrap gap-1.5 md:flex">
              {anime.genres.slice(0, 4).map((genre) => (
                <span
                  key={genre}
                  className="rounded-full border border-foreground/15 bg-background/40 px-2.5 py-0.5 text-xs text-foreground/80 backdrop-blur-sm"
                >
                  {genre}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2 pt-1">
            <Button asChild size="lg" className="rounded-full px-6">
              <Link to="/play/$malId" params={{ malId: anime.malId }}>
                <Play data-icon="inline-start" className="fill-current" />
                Watch now
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="rounded-full px-5"
            >
              <Link
                to="/series/$id"
                params={{ id: anime.malId }}
                preload="intent"
              >
                <Info data-icon="inline-start" />
                Details
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
