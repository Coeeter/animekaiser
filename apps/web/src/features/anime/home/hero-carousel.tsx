import type { AnimeItem } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import Autoplay from "embla-carousel-autoplay"
import useEmblaCarousel from "embla-carousel-react"
import { ArrowRight, ChevronLeft, ChevronRight, Star } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { formatAnimeFormat, formatAnimeStatus } from "../common/format"
import { animeTitlePreferenceAtom, getAnimeTitle } from "../common/title"

export function HeroCarousel({ items }: { items: ReadonlyArray<AnimeItem> }) {
  const titlePreference = useAtomValue(animeTitlePreferenceAtom)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 7000, stopOnInteraction: true }),
  ])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
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
    <section
      aria-label="Trending now"
      className="relative isolate overflow-hidden rounded-3xl bg-black ring-1 ring-white/10"
    >
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 p-4 sm:p-6 md:p-8">
        <div className="pointer-events-auto flex items-center gap-1.5">
          {items.map((anime, index) => (
            <button
              key={anime.malId}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === selectedIndex ? "true" : undefined}
              className="group/dot flex h-8 items-end py-3"
              onClick={() => emblaApi?.scrollTo(index)}
            >
              <span
                className={cn(
                  "h-1 rounded-full transition-all",
                  index === selectedIndex
                    ? "w-7 bg-white"
                    : "w-2 bg-white/40 group-hover/dot:bg-white/70"
                )}
              />
            </button>
          ))}
        </div>

        <div className="pointer-events-auto hidden items-center gap-2 sm:flex">
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/65 hover:text-white"
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft />
            <span className="sr-only">Previous</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/65 hover:text-white"
            onClick={() => emblaApi?.scrollNext()}
          >
            <ChevronRight />
            <span className="sr-only">Next</span>
          </Button>
        </div>
      </div>
    </section>
  )
}

function HeroSlide({
  anime,
  rank,
  title,
}: {
  anime: AnimeItem
  rank: number
  title: string
}) {
  const image = anime.bannerImage ?? anime.coverImage
  const status = formatAnimeStatus(anime.status)

  const meta = [
    formatAnimeFormat(anime.format),
    anime.seasonYear ? String(anime.seasonYear) : null,
    anime.episodes ? `${anime.episodes} eps` : null,
    status,
  ].filter(Boolean)

  return (
    <div className="relative min-w-0 shrink-0 grow-0 basis-full">
      <div className="relative aspect-4/5 sm:aspect-2/1 md:aspect-[2.6/1]">
        {image ? (
          <img
            src={image}
            alt=""
            className="size-full object-cover"
            loading={rank === 1 ? "eager" : "lazy"}
            fetchPriority={rank === 1 ? "high" : "auto"}
            decoding="async"
          />
        ) : (
          <div className="size-full bg-muted" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent" />
      </div>

      <Link
        to="/series/$id"
        params={{ id: anime.malId }}
        preload="intent"
        aria-label={title}
        className="absolute inset-0 z-0"
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end gap-5 p-4 pb-14 sm:p-6 sm:pb-16 md:p-8 md:pb-20">
        {anime.coverImage ? (
          <img
            src={anime.coverImage}
            alt=""
            className="hidden aspect-2/3 w-24 shrink-0 rounded-xl object-cover shadow-2xl ring-1 ring-white/15 sm:block md:w-32"
            loading="lazy"
            decoding="async"
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
            #{rank} Trending
          </p>

          <h2 className="max-w-2xl font-heading text-2xl leading-[1.1] font-black tracking-tight text-white sm:text-3xl md:text-5xl">
            {title}
          </h2>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70 sm:text-sm">
            {anime.averageScore ? (
              <span className="inline-flex items-center gap-1 font-semibold text-white">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                {(anime.averageScore / 10).toFixed(1)}
              </span>
            ) : null}
            {meta.map((entry) => (
              <span key={entry}>{entry}</span>
            ))}
          </div>

          {anime.genres.length > 0 ? (
            <p className="truncate text-xs text-white/55">
              {anime.genres.slice(0, 4).join(" · ")}
            </p>
          ) : null}

          <div className="pointer-events-auto relative z-10 pt-1.5">
            <Button asChild size="sm" className="md:h-10 md:px-5">
              <Link to="/series/$id" params={{ id: anime.malId }}>
                View details
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
