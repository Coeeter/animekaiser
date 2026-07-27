import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import type {
  StreamAudio,
  StreamEpisode,
  StreamProviderEpisodes,
  StreamProviderId,
} from "@workspace/domain"
import { streamProviderIds } from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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
import { AnimeTitle } from "../anime/common/anime-title"
import { streamEpisodesAtom } from "./atoms"
import {
  audioLabel,
  episodeLabel,
  episodeTitle,
  preferredAudio,
  providerLabel,
} from "./player-format"

export function EpisodeSheet({
  open,
  onOpenChange,
  portalContainer,
  selection,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  portalContainer: HTMLElement | null
  selection: {
    malId: number
    provider: StreamProviderId
    episodeId: string
    audio: StreamAudio
  }
}) {
  const [selectedProvider, setSelectedProvider] = useState(selection.provider)
  const result = useAtomValue(
    streamEpisodesAtom(selection.malId, selectedProvider)
  )

  const catalog = Result.builder(result)
    .onSuccess((value) => value)
    .orNull()

  const provider =
    catalog?.providers.find((item) => item.provider === selectedProvider) ??
    null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[min(92vw,28rem)] bg-background"
        portalContainer={portalContainer}
        side="right"
      >
        <SheetHeader>
          <SheetTitle>Choose a stream</SheetTitle>
          <SheetDescription>
            Switch providers and choose an episode of{" "}
            {catalog ? (
              <AnimeTitle title={catalog.anime.title} />
            ) : (
              "this anime"
            )}
            .
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-6 pb-6">
          <Select
            value={selectedProvider}
            onValueChange={(value) => {
              setSelectedProvider(value as StreamProviderId)
            }}
          >
            <SelectTrigger className="mb-2 w-full">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent portalContainer={portalContainer}>
              <SelectGroup>
                {streamProviderIds.map((providerId) => (
                  <SelectItem key={providerId} value={providerId}>
                    {providerLabel(providerId)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {provider ? (
            <EpisodeSheetList
              key={selectedProvider}
              provider={provider}
              selectedProvider={selectedProvider}
              selection={selection}
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
  selectedProvider,
  selection,
  onSelect,
}: {
  provider: StreamProviderEpisodes
  selectedProvider: StreamProviderId
  selection: {
    malId: number
    provider: StreamProviderId
    episodeId: string
    audio: StreamAudio
  }
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
                  selection={selection}
                  selectedProvider={selectedProvider}
                  onSelect={onSelect}
                />
              ) : (
                <EpisodeSheetRow
                  key={episode.id}
                  episode={episode}
                  selection={selection}
                  selectedProvider={selectedProvider}
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
  playbackAudio: StreamAudio
) {
  return episode.availableAudio.includes(playbackAudio)
    ? playbackAudio
    : preferredAudio(episode)
}

function EpisodeSheetRow({
  episode,
  selection,
  selectedProvider,
  onSelect,
}: {
  episode: StreamEpisode
  selection: {
    malId: number
    provider: StreamProviderId
    episodeId: string
    audio: StreamAudio
  }
  selectedProvider: StreamProviderId
  onSelect: () => void
}) {
  const audio = episodeAudioForPlayback(episode, selection.audio)
  const isCurrent =
    selectedProvider === selection.provider &&
    episode.id === selection.episodeId
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
          <span
            className="truncate text-sm font-medium"
            title={title ?? episodeLabel(episode)}
          >
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
    <Link
      to="/watch/$malId/$provider/$episodeId"
      params={{
        malId: selection.malId,
        provider: selectedProvider,
        episodeId: episode.id,
      }}
      search={{ audio }}
      className={className}
      onClick={onSelect}
    >
      {content}
    </Link>
  )
}

function EpisodeSheetNumberButton({
  episode,
  selection,
  selectedProvider,
  onSelect,
}: {
  episode: StreamEpisode
  selection: {
    malId: number
    provider: StreamProviderId
    episodeId: string
    audio: StreamAudio
  }
  selectedProvider: StreamProviderId
  onSelect: () => void
}) {
  const audio = episodeAudioForPlayback(episode, selection.audio)
  const isCurrent =
    selectedProvider === selection.provider &&
    episode.id === selection.episodeId
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
      <Link
        to="/watch/$malId/$provider/$episodeId"
        params={{
          malId: selection.malId,
          provider: selectedProvider,
          episodeId: episode.id,
        }}
        search={{ audio }}
        onClick={onSelect}
      >
        {episode.number}
      </Link>
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
