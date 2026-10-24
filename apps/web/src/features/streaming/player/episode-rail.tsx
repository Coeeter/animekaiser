import type { StreamEpisode, StreamPlayback } from "@animekaiser/domain"
import { cn } from "@animekaiser/ui/lib/utils"
import { useAtomValue } from "@effect/atom-react"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { CircleCheck } from "lucide-react"
import { useLayoutEffect, useRef } from "react"
import { episodeProgressAtom, episodeSpoilerAtom } from "../../history/atoms"
import type { EpisodeProgress } from "../../history/episode-progress"
import { providerLabelAtom } from "../atoms"
import { EpisodeThumbnail } from "../episode-thumbnail"
import {
  audioLabel,
  episodeLabel,
  episodeTitle,
  preferredAudio,
} from "../player-format"
import { NextSeasonUpNext } from "./mobile-panel"

export function PlayerEpisodeRail({
  playback,
  episodes,
}: {
  playback: StreamPlayback
  episodes: ReadonlyArray<StreamEpisode>
}) {
  const providerName = useAtomValue(providerLabelAtom(playback.provider))
  const progressByEpisode = AsyncResult.builder(
    useAtomValue(
      episodeProgressAtom({
        malId: playback.anime.malId,
        provider: playback.provider,
      })
    )
  )
    .onSuccess((value) => value)
    .orElse(() => new Map<number, EpisodeProgress>())
  const listRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const list = listRef.current
    const current = list?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!list || !current) return
    list.scrollTop =
      current.offsetTop - (list.clientHeight - current.offsetHeight) / 2
  }, [playback.episode.id, episodes.length])

  return (
    <aside className="sticky top-0 flex h-dvh w-96 shrink-0 flex-col border-l bg-background text-foreground">
      <div className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-heading text-base font-semibold">Episodes</h2>
        <span className="text-xs text-muted-foreground">
          {providerName} · {episodes.length}
        </span>
      </div>
      <div
        ref={listRef}
        className="relative flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2"
      >
        {episodes.map((episode) => (
          <EpisodeRailRow
            key={episode.id}
            playback={playback}
            episode={episode}
            progress={progressByEpisode.get(episode.number)}
          />
        ))}
        {playback.anime.status === "FINISHED" ? (
          <div className="px-2 pt-2">
            <NextSeasonUpNext playback={playback} count={0} />
          </div>
        ) : null}
      </div>
    </aside>
  )
}

function EpisodeRailRow({
  playback,
  episode,
  progress,
}: {
  playback: StreamPlayback
  episode: StreamEpisode
  progress: EpisodeProgress | undefined
}) {
  const current = episode.id === playback.episode.id
  const audio = episode.availableAudio.includes(playback.audio)
    ? playback.audio
    : preferredAudio(episode)
  const title = episodeTitle(episode)
  const watched = progress?.watched ?? false
  const spoiler = useAtomValue(
    episodeSpoilerAtom({
      malId: playback.anime.malId,
      provider: playback.provider,
      number: episode.number,
    })
  )
  const status = current
    ? "Now playing"
    : watched
      ? "Watched"
      : progress?.continueWatching
        ? `${progress.progressPercent}% watched`
        : episode.availableAudio.map(audioLabel).join(" / ")

  const content = (
    <>
      <EpisodeThumbnail
        blur={spoiler && !current}
        image={episode.image}
        number={episode.number}
        progress={
          watched || (progress?.progressPercent ?? 0) > 0
            ? progress?.progressPercent
            : undefined
        }
        highlighted={current}
        className="w-28"
      />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm leading-snug font-medium">
          {title ?? episodeLabel(episode)}
        </span>
        <span
          className={cn(
            "mt-0.5 block truncate text-xs text-muted-foreground",
            current && "text-primary"
          )}
        >
          {title ? `${episodeLabel(episode)} · ${status}` : status}
        </span>
      </span>
      {watched && !current ? (
        <CircleCheck className="size-4 shrink-0 text-muted-foreground" />
      ) : null}
    </>
  )

  const className = cn(
    "flex items-center gap-3 rounded-xl p-2 transition hover:bg-accent",
    current && "bg-accent ring-1 ring-primary/50",
    watched && !current && "opacity-60 hover:opacity-100",
    !audio && "pointer-events-none opacity-40"
  )

  if (!audio || current) {
    return (
      <div className={className} aria-current={current ? "true" : undefined}>
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
