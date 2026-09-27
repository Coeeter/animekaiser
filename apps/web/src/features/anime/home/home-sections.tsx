import type { AnimeItem } from "@animekaiser/domain"
import { cn } from "@animekaiser/ui/lib/utils"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { Star } from "lucide-react"
import type { RowLink } from "../common/anime-scroll-row"
import { MediaRow, SectionHeading } from "../common/anime-scroll-row"
import { AnimeTitle } from "../common/anime-title"
import { formatAnimeFormat } from "../common/format"
import { latestEpisodesAtom } from "../latest/atoms"
import { LatestEpisodeCard } from "../latest/latest-episodes-page"

const formatScore = (anime: AnimeItem) =>
  anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null

const seasonLabel = (anime: AnimeItem) =>
  anime.season && anime.seasonYear
    ? `${anime.season.charAt(0)}${anime.season.slice(1).toLowerCase()} ${anime.seasonYear}`
    : anime.seasonYear
      ? String(anime.seasonYear)
      : null

function AnimeMeta({ anime, when }: { anime: AnimeItem; when?: boolean }) {
  const score = formatScore(anime)
  const parts = [
    formatAnimeFormat(anime.format),
    when ? seasonLabel(anime) : anime.episodes ? `${anime.episodes} eps` : null,
  ].filter(Boolean)

  return (
    <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
      {score && !when ? (
        <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
          <Star className="size-3 fill-amber-400 text-amber-400" />
          {score}
        </span>
      ) : null}
      {parts.join(" · ")}
    </p>
  )
}

export function NewEpisodesRow() {
  const result = useAtomValue(latestEpisodesAtom)

  return Result.builder(result)
    .onSuccess((items) =>
      items.length === 0 ? null : (
        <MediaRow
          title="New episodes"
          eyebrow="Just aired"
          more={{ to: "/latest-episodes" }}
        >
          {items.slice(0, 16).map((item) => (
            <LatestEpisodeCard
              key={`${item.anime.malId}:${item.episode}`}
              item={item}
              className="w-60 shrink-0 sm:w-64"
            />
          ))}
        </MediaRow>
      )
    )
    .orElse(() => null)
}

export function RankedList({
  title,
  eyebrow,
  items,
  more,
}: {
  title: string
  eyebrow: string
  items: ReadonlyArray<AnimeItem>
  more: RowLink
}) {
  if (items.length === 0) return null

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <SectionHeading title={title} eyebrow={eyebrow} more={more} />
      <ol className="flex flex-col">
        {items.slice(0, 10).map((anime, index) => (
          <li key={anime.malId} className={cn(index >= 5 && "hidden md:block")}>
            <Link
              to="/series/$id"
              params={{ id: anime.malId }}
              preload="intent"
              className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-muted/60"
            >
              <span
                className={cn(
                  "w-10 shrink-0 text-center font-heading text-3xl leading-none font-black tabular-nums",
                  index < 3 ? "text-primary" : "text-foreground/20"
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              {anime.coverImage ? (
                <img
                  src={anime.coverImage}
                  alt=""
                  className="aspect-2/3 w-10 shrink-0 rounded-md object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium group-hover:text-primary">
                  <AnimeTitle title={anime.title} />
                </p>
                <AnimeMeta anime={anime} />
                {anime.genres.length > 0 ? (
                  <p className="truncate text-xs text-muted-foreground/70">
                    {anime.genres.slice(0, 3).join(" · ")}
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function CompactList({
  title,
  items,
  more,
  when = false,
}: {
  title: string
  items: ReadonlyArray<AnimeItem>
  more: RowLink
  when?: boolean
}) {
  if (items.length === 0) return null

  return (
    <section className="flex w-[85%] min-w-0 shrink-0 snap-start flex-col gap-2 rounded-2xl border bg-card/40 p-3 md:w-auto">
      <div className="px-1 pt-1">
        <SectionHeading title={title} more={more} />
      </div>
      <ul className="flex flex-col">
        {items.slice(0, 5).map((anime) => (
          <li key={anime.malId}>
            <Link
              to="/series/$id"
              params={{ id: anime.malId }}
              preload="intent"
              className="group flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-muted/60"
            >
              {anime.coverImage ? (
                <img
                  src={anime.coverImage}
                  alt=""
                  className="aspect-2/3 w-11 shrink-0 rounded-md object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="aspect-2/3 w-11 shrink-0 rounded-md bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm leading-snug font-medium group-hover:text-primary">
                  <AnimeTitle title={anime.title} />
                </p>
                <AnimeMeta anime={anime} when={when} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

const featuredGenres = [
  "Action",
  "Romance",
  "Comedy",
  "Fantasy",
  "Slice of Life",
  "Drama",
  "Sci-Fi",
  "Mystery",
]

// Each tile borrows art from a show already on the page, so the strip costs
// no extra requests and never shows the same show twice.
const genreArt = (pool: ReadonlyArray<AnimeItem>) => {
  const used = new Set<number>()
  return featuredGenres.map((genre) => {
    const anime = pool.find(
      (item) =>
        item.genres.includes(genre) &&
        !used.has(item.malId) &&
        (item.bannerImage ?? item.coverImage)
    )
    if (anime) used.add(anime.malId)
    return { genre, image: anime?.bannerImage ?? anime?.coverImage ?? null }
  })
}

export function GenreTiles({ pool }: { pool: ReadonlyArray<AnimeItem> }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <SectionHeading
        title="Browse by genre"
        eyebrow="Explore"
        more={{ to: "/series", search: { page: 1, sort: "popularity" } }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {genreArt(pool).map(({ genre, image }) => (
          <Link
            key={genre}
            to="/series"
            search={{ genre, page: 1, sort: "popularity" }}
            className="group relative isolate flex aspect-[2/1] items-end overflow-hidden rounded-2xl bg-muted p-3 ring-1 ring-white/10 transition hover:ring-primary/60"
          >
            {image ? (
              <img
                src={image}
                alt=""
                className="absolute inset-0 -z-10 size-full object-cover transition duration-500 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
            ) : null}
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
            <span className="font-heading text-base font-bold text-white md:text-lg">
              {genre}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
