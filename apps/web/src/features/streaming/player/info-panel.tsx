import type {
  AnimeDetail,
  StreamEpisode,
  StreamPlayback,
} from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Link } from "@tanstack/react-router"
import {
  ChevronRight,
  Maximize2,
  Server,
  SkipBack,
  SkipForward,
  Star,
} from "lucide-react"
import { AnimeTitle } from "../../anime/common/anime-title"
import {
  formatAnimeFormat,
  formatAnimeSeason,
  formatAnimeStatus,
  stripHtml,
} from "../../anime/common/format"
import { NextAiringNotice } from "../../anime/schedule/next-airing-notice"
import { PlayerWatchTogether } from "../../rooms/watch-together"
import { providerLabelAtom } from "../atoms"
import { audioLabel, episodeLabel, episodeTitle } from "../player-format"
import { updatePlayerPreferencesAtom } from "../preferences"

export function PlayerInfoPanel({
  playback,
  currentTime,
  previousEpisode,
  onNext,
  nextLabel,
  onNavigateToEpisode,
  onOpenSources,
}: {
  playback: StreamPlayback
  currentTime: number
  previousEpisode: StreamEpisode | null
  onNext: (() => void) | null
  nextLabel: string
  onNavigateToEpisode: (episode: StreamEpisode | null) => void
  onOpenSources: () => void
}) {
  const providerName = useAtomValue(providerLabelAtom(playback.provider))
  const updatePreferences = useAtomSet(updatePlayerPreferencesAtom)
  const title = episodeTitle(playback.episode)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-xl leading-tight font-bold tracking-tight text-white">
            <AnimeTitle title={playback.anime.title} />
          </h1>
          <p className="text-sm text-white/60">
            {episodeLabel(playback.episode)}
            {title ? ` · ${title}` : ""}
          </p>
          {playback.episode.description ? (
            <p className="line-clamp-2 max-w-3xl text-sm leading-relaxed text-white/50">
              {playback.episode.description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={!previousEpisode}
            onClick={() => onNavigateToEpisode(previousEpisode)}
          >
            <SkipBack data-icon="inline-start" />
            Previous
          </Button>
          <Button disabled={!onNext} onClick={() => onNext?.()}>
            <SkipForward data-icon="inline-start" />
            {nextLabel}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onOpenSources}>
          <Server data-icon="inline-start" />
          {providerName} · {playback.server.name} · {audioLabel(playback.audio)}
        </Button>
        <PlayerWatchTogether
          playback={playback}
          currentTime={currentTime}
          variant="secondary"
        />
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-white/70 hover:bg-white/10 hover:text-white"
          onClick={() => updatePreferences({ viewMode: "immersive" })}
        >
          <Maximize2 data-icon="inline-start" />
          Immersive
        </Button>
      </div>

      <SeriesCard anime={playback.anime} />
    </div>
  )
}

function SeriesCard({ anime }: { anime: AnimeDetail }) {
  const description = stripHtml(anime.description)
  const meta = [
    anime.format ? formatAnimeFormat(anime.format) : null,
    formatAnimeStatus(anime.status),
    anime.seasonYear
      ? [formatAnimeSeason(anime.season), anime.seasonYear]
          .filter(Boolean)
          .join(" ")
      : null,
    anime.episodes ? `${anime.episodes} eps` : null,
  ].filter(Boolean)

  return (
    <Link
      to="/series/$id"
      params={{ id: anime.malId }}
      className="group flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20 hover:bg-white/[0.06]"
    >
      {anime.coverImage ? (
        <img
          src={anime.coverImage}
          alt=""
          className="aspect-2/3 w-20 shrink-0 rounded-lg object-cover"
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
        <p className="truncate font-heading text-base font-semibold text-white">
          <AnimeTitle title={anime.title} />
        </p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-white/55">
          {anime.averageScore ? (
            <span className="inline-flex items-center gap-1 font-medium text-white">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              {(anime.averageScore / 10).toFixed(1)}
            </span>
          ) : null}
          {meta.map((item) => (
            <span
              key={item}
              className="before:mr-1.5 before:content-['·'] first:before:hidden"
            >
              {item}
            </span>
          ))}
        </p>
        <NextAiringNotice nextAiringEpisode={anime.nextAiringEpisode} />
        {description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-white/60">
            {description}
          </p>
        ) : null}
        <span className="mt-auto inline-flex items-center gap-0.5 text-xs font-medium text-white/70 group-hover:text-white">
          View details
          <ChevronRight className="size-3.5" />
        </span>
      </div>
    </Link>
  )
}
