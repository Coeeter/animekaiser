import type { StreamEpisode, StreamPlayback } from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import { Button } from "@animekaiser/ui/components/button"
import { cn } from "@animekaiser/ui/lib/utils"
import { Link } from "@tanstack/react-router"
import {
  ChevronRight,
  Info,
  ListVideo,
  Play,
  Server,
  SkipBack,
  SkipForward,
} from "lucide-react"
import type { ReactNode } from "react"
import { AnimeTitle } from "../anime/common/anime-title"
import {
  audioLabel,
  episodeLabel,
  episodeTitle,
  preferredAudio,
  providerLabel,
} from "./player-format"

export function PlayerMobilePanel({
  playback,
  episodes,
  previousEpisode,
  nextEpisode,
  onOpenEpisodes,
  onOpenServers,
  onNavigateToEpisode,
}: {
  playback: StreamPlayback
  episodes: ReadonlyArray<StreamEpisode>
  previousEpisode: StreamEpisode | null
  nextEpisode: StreamEpisode | null
  onOpenEpisodes: () => void
  onOpenServers: () => void
  onNavigateToEpisode: (episode: StreamEpisode | null) => void
}) {
  const displayTitle = episodeTitle(playback.episode)

  return (
    <div className="flex flex-col gap-5 bg-background px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-foreground md:hidden">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-xl leading-tight font-bold tracking-tight">
          <AnimeTitle title={playback.anime.title} />
        </h1>
        <p className="text-sm text-muted-foreground">
          {episodeLabel(playback.episode)}
          {displayTitle ? ` · ${displayTitle}` : ""}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{providerLabel(playback.provider)}</Badge>
          <Badge variant="outline">{audioLabel(playback.audio)}</Badge>
          <Badge variant="outline">{playback.server.name}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="lg"
          disabled={!previousEpisode}
          onClick={() => onNavigateToEpisode(previousEpisode)}
        >
          <SkipBack data-icon="inline-start" />
          Previous
        </Button>
        <Button
          size="lg"
          disabled={!nextEpisode}
          onClick={() => onNavigateToEpisode(nextEpisode)}
        >
          <SkipForward data-icon="inline-start" />
          Next
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <PanelRow
          icon={<ListVideo />}
          label="Episodes"
          value={`${providerLabel(playback.provider)} · ${episodes.length || "—"}`}
          onClick={onOpenEpisodes}
        />
        <PanelRow
          icon={<Server />}
          label="Stream server"
          value={playback.server.name}
          onClick={onOpenServers}
        />
        <PanelRow
          icon={<Info />}
          label="Series details"
          value="Synopsis, cast, related"
          to={{ malId: playback.anime.malId }}
        />
      </div>

      {episodes.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-base font-semibold">Up next</h2>
            <button
              type="button"
              onClick={onOpenEpisodes}
              className="text-xs font-medium text-primary"
            >
              All episodes
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {upcomingEpisodes(episodes, playback.episode.id).map((episode) => (
              <MobileEpisodeRow
                key={episode.id}
                playback={playback}
                episode={episode}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

const upcomingEpisodes = (
  episodes: ReadonlyArray<StreamEpisode>,
  currentEpisodeId: string
) => {
  const currentIndex = episodes.findIndex(
    (episode) => episode.id === currentEpisodeId
  )
  const start = currentIndex >= 0 ? currentIndex : 0
  return episodes.slice(start, start + 6)
}

function PanelRow({
  icon,
  label,
  value,
  onClick,
  to,
}: {
  icon: ReactNode
  label: string
  value: string
  onClick?: () => void
  to?: { malId: number }
}) {
  const className =
    "flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-card/70 px-3 text-left transition active:bg-accent"

  const content = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {value}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </>
  )

  if (to) {
    return (
      <Link to="/series/$id" params={{ id: to.malId }} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}

function MobileEpisodeRow({
  playback,
  episode,
}: {
  playback: StreamPlayback
  episode: StreamEpisode
}) {
  const audio = episode.availableAudio.includes(playback.audio)
    ? playback.audio
    : preferredAudio(episode)
  const isCurrent = episode.id === playback.episode.id
  const title = episodeTitle(episode)

  const content = (
    <>
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-xl border bg-muted text-sm font-semibold tabular-nums",
          isCurrent && "border-primary bg-primary text-primary-foreground"
        )}
      >
        {episode.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {title ?? episodeLabel(episode)}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {isCurrent
            ? "Now playing"
            : episode.availableAudio.map(audioLabel).join(" / ")}
        </span>
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full border text-muted-foreground">
        <Play className="size-4" />
      </span>
    </>
  )

  const className = cn(
    "flex min-h-16 items-center gap-3 rounded-2xl border bg-card/70 p-2.5 transition active:bg-accent",
    isCurrent && "border-primary/60 bg-accent",
    !audio && "opacity-60"
  )

  if (!audio || isCurrent) {
    return (
      <div className={className} aria-current={isCurrent ? "true" : undefined}>
        {content}
      </div>
    )
  }

  return (
    <Link
      to="/watch/$malId/$provider/$episodeId"
      params={{
        malId: playback.anime.malId,
        provider: playback.provider,
        episodeId: episode.id,
      }}
      search={{ audio }}
      className={className}
    >
      {content}
    </Link>
  )
}
