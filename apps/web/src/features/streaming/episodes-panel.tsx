import { Result, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import type {
  AnimeDetail,
  StreamAudio,
  StreamProviderEpisodes,
} from "@workspace/domain"
import { StreamProviderId } from "@workspace/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Input } from "@workspace/ui/components/input"
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
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Play,
  RadioTower,
  RotateCcw,
  Search,
  TvMinimalPlay,
} from "lucide-react"
import { useMemo, useState } from "react"
import * as Schema from "effect/Schema"
import { streamEpisodesAtom } from "./atoms"

const decodeProviderId = Schema.decodeUnknownSync(StreamProviderId)

const providerLabels: Record<StreamProviderId, string> = {
  provider-a: "ProviderA",
}

const providerLabel = (provider: StreamProviderId) => providerLabels[provider]

const audioLabels: Record<StreamAudio, string> = {
  sub: "Sub",
  dub: "Dub",
}

const audioLabel = (audio: StreamAudio) => audioLabels[audio]

type ProviderEpisode = StreamProviderEpisodes["episodes"][number]

type EpisodeActionState = {
  watched?: boolean
  continueWatching?: boolean
  progressPercent?: number
  current?: boolean
}

const preferredAudio = (episode: ProviderEpisode): StreamAudio | null => {
  if (episode.availableAudio.includes("sub")) return "sub"
  if (episode.availableAudio.includes("dub")) return "dub"
  return null
}

const episodeHrefProps = ({
  anime,
  provider,
  episode,
  audio,
}: {
  anime: AnimeDetail
  provider: StreamProviderEpisodes
  episode: ProviderEpisode
  audio: StreamAudio
}) => ({
  to: "/watch/$malId/$provider/$episodeId" as const,
  params: {
    malId: anime.malId,
    provider: provider.provider,
    episodeId: episode.id,
  },
  search: { audio },
})

const episodeLabel = (episode: ProviderEpisode) => `Episode ${episode.number}`

const isGenericEpisodeTitle = (episode: ProviderEpisode) =>
  episode.title.trim().toLowerCase() === episodeLabel(episode).toLowerCase()

const episodeTitle = (episode: ProviderEpisode) =>
  isGenericEpisodeTitle(episode) ? null : episode.title

const clampProgress = (value: number | undefined) =>
  Math.min(Math.max(value ?? 0, 0), 100)

export function EpisodesPanel({
  anime,
  page,
  onPageChange,
}: {
  anime: AnimeDetail
  page: number
  onPageChange: (page: number) => void
}) {
  const result = useAtomValue(streamEpisodesAtom(anime.malId))
  const [selectedProvider, setSelectedProvider] = useState("provider-a")

  const catalog = Result.match(result, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  })
  const providers = catalog?.providers ?? []
  const currentProvider =
    providers.find((provider) => provider.provider === selectedProvider) ??
    providers.at(0) ??
    null
  const selectValue = currentProvider
    ? currentProvider.provider
    : selectedProvider
  const isLoading = Result.isWaiting(result)
  const isFailed = !isLoading && result._tag === "Failure"

  if (isLoading && !catalog) return <EpisodesPending />

  if (isFailed) {
    return (
      <EpisodesEmpty
        title="Episodes are unavailable"
        description="The streaming providers could not be reached right now."
      />
    )
  }

  if (!currentProvider) {
    return (
      <EpisodesEmpty
        title="Episodes are not available yet"
        description="No streaming provider is configured for this title."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card/80 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Episodes</p>
          <p className="text-xs text-muted-foreground">
            Choose a provider, then pick an episode to watch.
          </p>
        </div>
        <Select
          value={selectValue}
          onValueChange={(value) => {
            setSelectedProvider(decodeProviderId(value))
            onPageChange(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {providers.map((provider) => (
                <SelectItem key={provider.provider} value={provider.provider}>
                  {providerLabel(provider.provider)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <ProviderEpisodes
        anime={anime}
        provider={currentProvider}
        page={page}
        onPageChange={onPageChange}
      />
    </div>
  )
}

function ProviderEpisodes({
  anime,
  provider,
  page,
  onPageChange,
}: {
  anime: AnimeDetail
  provider: StreamProviderEpisodes
  page: number
  onPageChange: (page: number) => void
}) {
  const [query, setQuery] = useState("")
  const [descending, setDescending] = useState(false)

  const filteredEpisodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const matches = provider.episodes.filter((episode) => {
      if (normalizedQuery.length === 0) return true
      return [
        String(episode.number),
        episode.title,
        episode.japaneseTitle ?? "",
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    })
    return Array.from(matches).sort((left, right) =>
      descending ? right.number - left.number : left.number - right.number
    )
  }, [descending, provider.episodes, query])

  if (provider.status !== "available") {
    return (
      <EpisodesEmpty
        title={
          provider.status === "unmatched"
            ? "No provider match yet"
            : "Provider is unavailable"
        }
        description={
          provider.message ??
          "Try another provider once more streaming sources are available."
        }
      />
    )
  }

  if (provider.episodes.length === 0) {
    return (
      <EpisodesEmpty
        title="No episodes found"
        description="This provider matched the title, but returned no episodes."
      />
    )
  }

  const compact = provider.episodes.length >= 48
  const pageSize = compact ? 72 : 24
  const totalPages = Math.max(1, Math.ceil(filteredEpisodes.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleEpisodes = filteredEpisodes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value)
              onPageChange(1)
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
            onPageChange(1)
          }}
        >
          <ArrowDownUp data-icon="inline-start" />
          {descending ? "Newest first" : "Oldest first"}
        </Button>
      </div>

      {visibleEpisodes.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
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
                <EpisodeNumberButton
                  key={episode.id}
                  anime={anime}
                  provider={provider}
                  episode={episode}
                />
              ) : (
                <EpisodeRow
                  key={episode.id}
                  anime={anime}
                  provider={provider}
                  episode={episode}
                />
              )
            )}
          </div>
        </TooltipProvider>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          >
            <ChevronLeft data-icon="inline-start" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          >
            Next
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function EpisodeRow({
  anime,
  provider,
  episode,
  watched = false,
  continueWatching = false,
  progressPercent,
  current = false,
}: {
  anime: AnimeDetail
  provider: StreamProviderEpisodes
  episode: ProviderEpisode
} & EpisodeActionState) {
  const audio = preferredAudio(episode)
  const title = episodeTitle(episode)
  const progress = watched ? 100 : clampProgress(progressPercent)
  const showProgress = watched || continueWatching || progress > 0
  const content = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-2xl border bg-muted text-sm font-semibold tabular-nums",
            current && "border-primary bg-primary text-primary-foreground",
            watched && !current && "text-muted-foreground"
          )}
        >
          {episode.number}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">
              {title ?? episodeLabel(episode)}
            </p>
            {current ? <Badge>Now playing</Badge> : null}
            {continueWatching ? (
              <Badge variant="secondary">
                <RotateCcw data-icon="inline-start" />
                Continue
              </Badge>
            ) : null}
            {watched ? (
              <Badge variant="outline">
                <CheckCircle2 data-icon="inline-start" />
                Watched
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {title ? <span>{episodeLabel(episode)}</span> : null}
            {episode.japaneseTitle ? (
              <span className="truncate">{episode.japaneseTitle}</span>
            ) : null}
            {episode.availableAudio.map((item) => (
              <Badge key={item} variant="outline">
                {audioLabel(item)}
              </Badge>
            ))}
          </div>
          {showProgress ? (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full border bg-background text-foreground transition-colors",
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
    "group/episode flex min-h-20 items-center justify-between gap-4 rounded-xl border bg-card/70 p-3 text-left transition hover:border-primary/40 hover:bg-accent/60",
    current && "border-primary/60 bg-accent",
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
      {...episodeHrefProps({ anime, provider, episode, audio })}
      className={className}
    >
      {content}
    </Link>
  )
}

function EpisodeNumberButton({
  anime,
  provider,
  episode,
  watched = false,
  continueWatching = false,
  progressPercent,
  current = false,
}: {
  anime: AnimeDetail
  provider: StreamProviderEpisodes
  episode: ProviderEpisode
} & EpisodeActionState) {
  const audio = preferredAudio(episode)
  const title = episodeTitle(episode)
  const progress = watched ? 100 : clampProgress(progressPercent)
  const label = title ?? episodeLabel(episode)
  const buttonClassName = cn(
    "relative h-11 rounded-xl px-0 text-sm tabular-nums",
    current && "ring-2 ring-primary/40",
    watched && "text-muted-foreground"
  )

  const numberButton = audio ? (
    <Button
      asChild
      variant={current ? "default" : "outline"}
      className={buttonClassName}
    >
      <Link {...episodeHrefProps({ anime, provider, episode, audio })}>
        {episode.number}
      </Link>
    </Button>
  ) : (
    <span>
      <Button variant="outline" className={buttonClassName} disabled>
        {episode.number}
      </Button>
    </span>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{numberButton}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{label}</span>
          <span className="text-background/70">{episodeLabel(episode)}</span>
          <span className="text-background/70">
            {audio
              ? episode.availableAudio.map(audioLabel).join(" / ")
              : "No streams"}
          </span>
          {continueWatching ? (
            <span className="text-background/70">
              Continue {Math.round(progress)}%
            </span>
          ) : null}
          {watched ? <span className="text-background/70">Watched</span> : null}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function EpisodesPending() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-20 rounded-xl" />
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-20 rounded-xl" />
      ))}
    </div>
  )
}

function EpisodesEmpty({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {title.includes("provider") ? <RadioTower /> : <TvMinimalPlay />}
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
