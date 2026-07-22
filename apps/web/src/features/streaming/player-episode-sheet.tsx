import { Result, useAtomValue } from "@effect-atom/atom-react"
import type {
  StreamAudio,
  StreamEpisode,
  StreamPlayback,
  StreamProviderEpisodes,
} from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Play,
  Search,
} from "lucide-react"
import { useState } from "react"
import { AnimeTitle } from "../anime/anime-title"
import { streamEpisodesAtom } from "./atoms"
import {
  audioLabel,
  episodeLabel,
  episodeTitle,
  preferredAudio,
  providerLabel,
  watchHref,
} from "./player-format"

export function EpisodeSheet({
  open,
  onOpenChange,
  portalContainer,
  playback,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  portalContainer: HTMLElement | null
  playback: StreamPlayback
}) {
  const result = useAtomValue(
    streamEpisodesAtom(playback.anime.malId, playback.provider)
  )
  const catalog = Result.match(result, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  })
  const playbackProvider: string = playback.provider
  const provider =
    catalog?.providers.find((item) => item.provider === playbackProvider) ??
    null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[min(92vw,28rem)] bg-background"
        portalContainer={portalContainer}
        side="right"
      >
        <SheetHeader>
          <SheetTitle>Episodes</SheetTitle>
          <SheetDescription>
            {providerLabel(playback.provider)} episodes for{" "}
            <AnimeTitle title={playback.anime.title} />.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-6 pb-6">
          {provider ? (
            <EpisodeSheetList
              provider={provider}
              playback={playback}
              onSelect={() => onOpenChange(false)}
            />
          ) : (
            <EpisodeSheetPending />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function EpisodeSheetList({
  provider,
  playback,
  onSelect,
}: {
  provider: StreamProviderEpisodes
  playback: StreamPlayback
  onSelect: () => void
}) {
  const [query, setQuery] = useState("")
  const [descending, setDescending] = useState(false)
  const [page, setPage] = useState(1)

  const filteredEpisodes = provider.episodes
    .filter((episode) => {
      const normalizedQuery = query.trim().toLowerCase()
      if (normalizedQuery.length === 0) return true
      return [
        String(episode.number),
        episode.title,
        episode.japaneseTitle ?? "",
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    })
    .sort((left, right) =>
      descending ? right.number - left.number : left.number - right.number
    )
  const compact = provider.episodes.length >= 48
  const pageSize = compact ? 80 : 30
  const totalPages = Math.max(1, Math.ceil(filteredEpisodes.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleEpisodes = filteredEpisodes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  if (provider.status !== "available") {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        {provider.message ?? "This provider is unavailable."}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value)
              setPage(1)
            }}
            className="pl-9"
            placeholder="Search episodes"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDescending((value) => !value)
            setPage(1)
          }}
        >
          <ArrowDownUp data-icon="inline-start" />
          {descending ? "Newest first" : "Oldest first"}
        </Button>
      </div>

      {visibleEpisodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No episodes match your search.
        </div>
      ) : (
        <TooltipProvider>
          <div
            className={cn(
              "grid gap-2",
              compact
                ? "grid-cols-[repeat(auto-fill,minmax(3rem,1fr))]"
                : "grid-cols-1"
            )}
          >
            {visibleEpisodes.map((episode) =>
              compact ? (
                <EpisodeSheetNumberButton
                  key={episode.id}
                  episode={episode}
                  playback={playback}
                  onSelect={onSelect}
                />
              ) : (
                <EpisodeSheetRow
                  key={episode.id}
                  episode={episode}
                  playback={playback}
                  onSelect={onSelect}
                />
              )
            )}
          </div>
        </TooltipProvider>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft data-icon="inline-start" />
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            Next
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      ) : null}
    </>
  )
}

function episodeAudioForPlayback(
  episode: StreamEpisode,
  playback: StreamPlayback
) {
  return episode.availableAudio.includes(playback.audio)
    ? playback.audio
    : preferredAudio(episode)
}

function episodeWatchHref({
  episode,
  playback,
  audio,
}: {
  episode: StreamEpisode
  playback: StreamPlayback
  audio: StreamAudio
}) {
  return watchHref({
    malId: playback.anime.malId,
    provider: playback.provider,
    episodeId: episode.id,
    audio,
  })
}

function EpisodeSheetRow({
  episode,
  playback,
  onSelect,
}: {
  episode: StreamEpisode
  playback: StreamPlayback
  onSelect: () => void
}) {
  const audio = episodeAudioForPlayback(episode, playback)
  const isCurrent = episode.id === playback.episode.id
  const title = episodeTitle(episode)
  const content = (
    <>
      <div
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-2xl border bg-muted text-sm font-semibold tabular-nums",
          isCurrent && "border-primary bg-primary text-primary-foreground"
        )}
      >
        {episode.number}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">
            {title ?? episodeLabel(episode)}
          </span>
          {isCurrent ? <Badge>Now playing</Badge> : null}
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {title ? <span>{episodeLabel(episode)}</span> : null}
          {episode.availableAudio.map((item) => (
            <Badge key={item} variant="outline">
              {audioLabel(item)}
            </Badge>
          ))}
        </div>
      </div>
      <div
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full border bg-background transition-colors",
          audio &&
            "group-hover/episode:bg-primary group-hover/episode:text-primary-foreground",
          !audio && "text-muted-foreground"
        )}
      >
        <Play />
      </div>
    </>
  )
  const className = cn(
    "group/episode flex min-h-16 items-center gap-3 rounded-xl border bg-card/70 p-2.5 text-left transition hover:border-primary/40 hover:bg-accent/60",
    isCurrent && "border-primary/60 bg-accent",
    !audio && "opacity-60"
  )

  if (!audio) {
    return (
      <div className={className} aria-disabled="true">
        {content}
      </div>
    )
  }

  return (
    <a
      href={episodeWatchHref({ episode, playback, audio })}
      className={className}
      onClick={onSelect}
    >
      {content}
    </a>
  )
}

function EpisodeSheetNumberButton({
  episode,
  playback,
  onSelect,
}: {
  episode: StreamEpisode
  playback: StreamPlayback
  onSelect: () => void
}) {
  const audio = episodeAudioForPlayback(episode, playback)
  const isCurrent = episode.id === playback.episode.id
  const title = episodeTitle(episode)
  const label = title ?? episodeLabel(episode)
  const className = cn(
    "h-11 rounded-xl px-0 text-sm tabular-nums",
    isCurrent && "ring-2 ring-primary/40"
  )
  const trigger = audio ? (
    <Button
      asChild
      variant={isCurrent ? "default" : "outline"}
      className={className}
    >
      <a
        href={episodeWatchHref({ episode, playback, audio })}
        onClick={onSelect}
      >
        {episode.number}
      </a>
    </Button>
  ) : (
    <span>
      <Button variant="outline" className={className} disabled>
        {episode.number}
      </Button>
    </span>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{label}</span>
          <span className="text-background/70">{episodeLabel(episode)}</span>
          <span className="text-background/70">
            {audio
              ? episode.availableAudio.map(audioLabel).join(" / ")
              : "No streams"}
          </span>
          {isCurrent ? (
            <span className="text-background/70">Now playing</span>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function EpisodeSheetPending() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-14 rounded-2xl" />
      ))}
    </>
  )
}
