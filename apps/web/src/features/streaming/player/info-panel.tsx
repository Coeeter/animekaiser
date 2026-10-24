import type { StreamEpisode, StreamPlayback } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Link } from "@tanstack/react-router"
import { Info, Maximize2, Server, SkipBack, SkipForward } from "lucide-react"
import { AnimeTitle } from "../../anime/common/anime-title"
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

      {playback.episode.description || playback.anime.nextAiringEpisode ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {playback.episode.description ? (
            <p className="max-w-3xl text-sm leading-relaxed text-white/70">
              {playback.episode.description}
            </p>
          ) : null}
          <NextAiringNotice
            nextAiringEpisode={playback.anime.nextAiringEpisode}
          />
        </div>
      ) : null}

      <Button asChild variant="outline" className="self-start">
        <Link to="/series/$id" params={{ id: playback.anime.malId }}>
          <Info data-icon="inline-start" />
          More about this series
        </Link>
      </Button>
    </div>
  )
}
