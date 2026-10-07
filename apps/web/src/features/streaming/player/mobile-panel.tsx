import type {
  AnimeItem,
  StreamAudio,
  StreamEpisode,
  StreamPlayback,
  StreamProviderId,
} from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import { Button } from "@animekaiser/ui/components/button"
import { cn } from "@animekaiser/ui/lib/utils"
import { Result, useAtomValue } from "@effect-atom/atom-react"
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
import { AnimeTitle } from "../../anime/common/anime-title"
import { NextAiringNotice } from "../../anime/schedule/next-airing-notice"
import { episodeSpoilerAtom } from "../../history/atoms"
import { nextSeasonEpisodesAtom, providerLabelAtom } from "../atoms"
import { EpisodeThumbnail } from "../episode-thumbnail"
import {
  audioLabel,
  episodeLabel,
  episodeTitle,
  preferredAudio,
} from "../player-format"

export function PlayerMobilePanel({
  playback,
  episodes,
  previousEpisode,
  onNext,
  nextLabel,
  onOpenEpisodes,
  onOpenServers,
  onNavigateToEpisode,
  rail = false,
}: {
  rail?: boolean
  playback: StreamPlayback
  episodes: ReadonlyArray<StreamEpisode>
  previousEpisode: StreamEpisode | null
  onNext: (() => void) | null
  nextLabel: string
  onOpenEpisodes: () => void
  onOpenServers: () => void
  onNavigateToEpisode: (episode: StreamEpisode | null) => void
}) {
  const providerName = useAtomValue(providerLabelAtom(playback.provider))
  const displayTitle = episodeTitle(playback.episode)
  const upcoming = upcomingEpisodes(episodes, playback.episode.id)

  return (
    <div
      className={cn(
        "flex flex-col gap-5 bg-background px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-foreground",
        rail
          ? "md:sticky md:top-0 md:h-dvh md:w-96 md:shrink-0 md:overflow-y-auto md:border-l md:pb-6"
          : "md:hidden"
      )}
    >
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-xl leading-tight font-bold tracking-tight">
          <AnimeTitle title={playback.anime.title} />
        </h1>
        <p className="text-sm text-muted-foreground">
          {episodeLabel(playback.episode)}
          {displayTitle ? ` · ${displayTitle}` : ""}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{providerName}</Badge>
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
        <Button size="lg" disabled={!onNext} onClick={() => onNext?.()}>
          <SkipForward data-icon="inline-start" />
          <span className="truncate">{nextLabel}</span>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <PanelRow
          icon={<ListVideo />}
          label="Episodes"
          value={`${providerName} · ${episodes.length || "—"}`}
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

      <NextAiringNotice nextAiringEpisode={playback.anime.nextAiringEpisode} />

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
            {upcoming.map((episode) => (
              <MobileEpisodeRow
                key={episode.id}
                malId={playback.anime.malId}
                provider={playback.provider}
                audio={playback.audio}
                currentEpisodeId={playback.episode.id}
                episode={episode}
              />
            ))}
          </div>
          {upcoming.length < upNextLength &&
          playback.anime.status === "FINISHED" ? (
            <NextSeasonUpNext
              playback={playback}
              count={upNextLength - upcoming.length + 1}
            />
          ) : null}
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
  return episodes.slice(start, start + upNextLength)
}

const upNextLength = 6

const upcomingLabel = (anime: AnimeItem) => {
  const when = [
    anime.season && `${anime.season[0]}${anime.season.slice(1).toLowerCase()}`,
    anime.seasonYear,
  ]
    .filter(Boolean)
    .join(" ")
  return when ? `Upcoming · ${when}` : "Upcoming · date not announced"
}

// Near the end of a finished season, the rest of the list continues into the
// next entry of the watch order so "Next" never leads somewhere unseen.
function NextSeasonUpNext({
  playback,
  count,
}: {
  playback: StreamPlayback
  count: number
}) {
  const next = Result.builder(
    useAtomValue(
      nextSeasonEpisodesAtom({
        malId: playback.anime.malId,
        provider: playback.provider,
      })
    )
  )
    .onSuccess((value) => value)
    .orNull()

  if (!next) return null

  return (
    <div className="flex flex-col gap-2">
      <Link
        to="/series/$id"
        params={{ id: next.anime.malId }}
        className="mt-1 flex items-center gap-3 rounded-2xl px-1 py-1 transition hover:bg-accent"
      >
        {next.anime.coverImage ? (
          <img
            src={next.anime.coverImage}
            alt=""
            className="aspect-2/3 w-8 shrink-0 rounded-md object-cover"
          />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Next in the story
          </span>
          <span className="block truncate text-sm font-semibold">
            <AnimeTitle title={next.anime.title} />
          </span>
          {next.provider === null ? (
            <span className="block text-xs text-muted-foreground">
              {upcomingLabel(next.anime)}
            </span>
          ) : null}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
      {next.episodes.slice(0, count).map((episode) => (
        <MobileEpisodeRow
          key={episode.id}
          malId={next.anime.malId}
          provider={next.provider ?? playback.provider}
          audio={playback.audio}
          currentEpisodeId={null}
          episode={episode}
        />
      ))}
    </div>
  )
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
    "flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-card px-3 text-left transition active:bg-accent"

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
  malId,
  provider,
  audio: preferred,
  currentEpisodeId,
  episode,
}: {
  malId: number
  provider: StreamProviderId
  audio: StreamAudio
  currentEpisodeId: string | null
  episode: StreamEpisode
}) {
  const audio = episode.availableAudio.includes(preferred)
    ? preferred
    : preferredAudio(episode)
  const isCurrent = episode.id === currentEpisodeId
  const title = episodeTitle(episode)
  const spoiler = useAtomValue(
    episodeSpoilerAtom({
      malId,
      provider,
      number: episode.number,
    })
  )

  const content = (
    <>
      {episode.image ? (
        <EpisodeThumbnail
          blur={spoiler && !isCurrent}
          image={episode.image}
          number={episode.number}
          highlighted={isCurrent}
          className="w-24"
        />
      ) : (
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl border bg-muted text-sm font-semibold tabular-nums",
            isCurrent && "border-primary bg-primary text-primary-foreground"
          )}
        >
          {episode.number}
        </span>
      )}
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
    "flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-2.5 transition active:bg-accent",
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
        malId,
        provider,
        episodeId: episode.id,
      }}
      search={{ audio }}
      className={className}
    >
      {content}
    </Link>
  )
}
