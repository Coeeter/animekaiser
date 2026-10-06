import type {
  AnimeDetail,
  StreamAudio,
  StreamProviderEpisodes,
} from "@animekaiser/domain"
import { StreamProviderId } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@animekaiser/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@animekaiser/ui/components/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@animekaiser/ui/components/select"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { cn } from "@animekaiser/ui/lib/utils"
import { Result, useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  RadioTower,
  Search,
  TvMinimalPlay,
} from "lucide-react"
import type { ReactNode } from "react"
import { useMemo, useRef, useState } from "react"
import { DataError } from "../../components/data-error"
import { episodeProgressAtom } from "../history/atoms"
import type { EpisodeProgress } from "../history/episode-progress"
import {
  streamAvailabilityAtom,
  streamEpisodesAtom,
  streamProvidersAtom,
} from "./atoms"
import { EpisodeThumbnail } from "./episode-thumbnail"
import { preferredAudio } from "./player-format"
import { playerPreferencesAtom } from "./preferences"

const decodeProviderId = Schema.decodeUnknownSync(StreamProviderId)

const audioLabels: Record<StreamAudio, string> = {
  sub: "Sub",
  dub: "Dub",
}

const audioLabel = (audio: StreamAudio) => audioLabels[audio]

type ProviderEpisode = StreamProviderEpisodes["episodes"][number]

type EpisodeActionState = Partial<EpisodeProgress> & { current?: boolean }

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

const PAGE_SIZE = 24

const episodeRangeLabel = (episodes: ReadonlyArray<ProviderEpisode>) => {
  const first = episodes[0]
  const last = episodes[episodes.length - 1]
  if (!first || !last) return null
  const low = Math.min(first.number, last.number)
  const high = Math.max(first.number, last.number)
  return low === high ? `Episode ${low}` : `Episodes ${low}–${high}`
}

export function EpisodesPanel({
  anime,
  page,
  provider: selectedProvider,
  onPageChange,
  onProviderChange,
}: {
  anime: AnimeDetail
  page: number
  provider?: StreamProviderId
  onPageChange: (page: number) => void
  onProviderChange: (provider: StreamProviderId) => void
}) {
  const providerOptions = Result.getOrElse(
    useAtomValue(streamProvidersAtom),
    () => []
  )
  const result = useAtomValue(streamEpisodesAtom(anime.malId, selectedProvider))
  const refresh = useAtomRefresh(
    streamEpisodesAtom(anime.malId, selectedProvider)
  )

  const state = Result.builder(result)
    .onInitialOrWaiting(() => ({ catalog: null, loading: true, failed: false }))
    .onFailure(() => ({ catalog: null, loading: false, failed: true }))
    .onSuccess((value) => ({ catalog: value, loading: false, failed: false }))
    .render()

  const { catalog } = state
  // The catalog carries exactly the provider the server resolved, which may
  // differ from the requested one when the default sentinel is used.
  const currentProvider = catalog?.providers.at(0) ?? null

  const providerSelector = (
    <div className="flex items-center gap-2">
      <Select
        value={
          currentProvider?.provider ??
          selectedProvider ??
          providerOptions.at(0)?.id
        }
        onValueChange={(value) => onProviderChange(decodeProviderId(value))}
      >
        <SelectTrigger className="w-40" aria-label="Streaming source">
          <SelectValue placeholder="Provider">
            {
              providerOptions.find(
                (entry) =>
                  entry.id === (currentProvider?.provider ?? selectedProvider)
              )?.label
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {providerOptions.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.label}
                <ProviderAvailability malId={anime.malId} provider={entry.id} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )

  if (state.loading) {
    return (
      <div className="flex flex-col gap-4">
        {providerSelector}
        <EpisodesPending />
      </div>
    )
  }

  if (state.failed) {
    return (
      <div className="flex flex-col gap-4">
        {providerSelector}
        <DataError
          title="Episodes are unavailable"
          description="The streaming providers could not be reached right now."
          onRetry={refresh}
        />
      </div>
    )
  }

  if (!currentProvider) {
    return (
      <div className="flex flex-col gap-4">
        {providerSelector}
        <EpisodesEmpty
          title="Episodes are not available yet"
          description="No streaming provider is configured for this title."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ProviderEpisodes
        anime={anime}
        provider={currentProvider}
        page={page}
        onPageChange={onPageChange}
        providerSelector={providerSelector}
      />
    </div>
  )
}

function ProviderEpisodes({
  anime,
  provider,
  page,
  onPageChange,
  providerSelector,
}: {
  anime: AnimeDetail
  provider: StreamProviderEpisodes
  page: number
  onPageChange: (page: number) => void
  providerSelector: ReactNode
}) {
  const [query, setQuery] = useState("")
  const [descending, setDescending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const progressResult = useAtomValue(
    episodeProgressAtom({ malId: anime.malId, provider: provider.provider })
  )
  const progressByEpisode = Result.builder(progressResult)
    .onSuccess((value) => value)
    .orElse(() => new Map<number, EpisodeProgress>())

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
      <div className="flex flex-col gap-4">
        {providerSelector}
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
      </div>
    )
  }

  if (provider.episodes.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {providerSelector}
        <EpisodesEmpty
          title="No episodes found"
          description="This provider matched the title, but returned no episodes."
        />
      </div>
    )
  }

  const pageSize = PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(filteredEpisodes.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleEpisodes = filteredEpisodes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )
  const rangeLabel = episodeRangeLabel(visibleEpisodes)
  const pageRanges = Array.from({ length: totalPages }, (_, index) => ({
    page: index + 1,
    label:
      episodeRangeLabel(
        filteredEpisodes.slice(index * pageSize, (index + 1) * pageSize)
      ) ?? `Page ${index + 1}`,
  }))
  const goToPage = (next: number) => {
    onPageChange(Math.min(Math.max(next, 1), totalPages))
    listRef.current?.scrollIntoView({ block: "start" })
  }

  return (
    <div
      ref={listRef}
      className="flex scroll-mt-28 flex-col gap-3 md:scroll-mt-11"
    >
      <div className="sticky top-[6.25rem] z-10 -mx-4 flex flex-wrap items-center gap-2 bg-background/90 px-4 py-2 backdrop-blur-md md:top-11 md:-mx-6 md:px-6">
        {providerSelector}
        <InputGroup className="order-last h-9 min-w-48 basis-full sm:order-none sm:basis-auto sm:flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value)
              onPageChange(1)
            }}
            placeholder="Search episodes"
            aria-label="Search episodes"
          />
        </InputGroup>
        <Button
          type="button"
          variant="outline"
          className="ml-auto sm:ml-0"
          onClick={() => {
            setDescending((value) => !value)
            onPageChange(1)
          }}
        >
          <ArrowDownUp data-icon="inline-start" />
          {descending ? "Newest" : "Oldest"}
        </Button>
        {totalPages > 1 ? (
          <Select
            value={String(currentPage)}
            onValueChange={(value) => goToPage(Number(value))}
          >
            <SelectTrigger className="w-44" aria-label="Episode range">
              <SelectValue>{rangeLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {pageRanges.map((range) => (
                  <SelectItem key={range.page} value={String(range.page)}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {visibleEpisodes.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No episodes match your search.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleEpisodes.map((episode) => (
            <EpisodeCard
              key={episode.id}
              anime={anime}
              provider={provider}
              episode={episode}
              {...progressByEpisode.get(episode.number)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            <ChevronLeft data-icon="inline-start" />
            Previous
          </Button>
          <div className="flex min-w-0 flex-col items-center">
            {rangeLabel ? (
              <span className="truncate text-sm font-medium tabular-nums">
                {rangeLabel}
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground tabular-nums">
              Page {currentPage} of {totalPages}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function ProviderAvailability({
  malId,
  provider,
}: {
  malId: number
  provider: StreamProviderId
}) {
  const result = useAtomValue(streamAvailabilityAtom(malId))
  const label = Result.builder(result)
    .onSuccess((items) => {
      const entry = items.find((item) => item.provider === provider)
      if (entry?.status === "unavailable") return "Unavailable"
      if (entry?.status !== "available") return "No match"
      return entry.dub > 0
        ? `${entry.sub} sub · ${entry.dub} dub`
        : `${entry.sub} sub`
    })
    .onFailure(() => null)
    .orElse(() => "Checking…")

  return label ? (
    <span className="ml-auto text-xs font-normal text-muted-foreground">
      {label}
    </span>
  ) : null
}

function EpisodeCard({
  anime,
  provider,
  episode,
  watched = false,
  continueWatching = false,
  progressPercent,
  upNext = false,
  current = false,
}: {
  anime: AnimeDetail
  provider: StreamProviderEpisodes
  episode: ProviderEpisode
} & EpisodeActionState) {
  const { preferredAudio: audioPreference, blurUnwatched } = useAtomValue(
    playerPreferencesAtom
  )
  const audio = preferredAudio(episode, audioPreference)
  const title = episodeTitle(episode)
  const progress = watched ? 100 : clampProgress(progressPercent)
  const highlighted = current || upNext
  const hideSpoilers =
    blurUnwatched && !watched && !continueWatching && !current
  const status = current
    ? "Now playing"
    : upNext
      ? "Up next"
      : continueWatching
        ? "Continue"
        : watched
          ? "Watched"
          : null
  const content = (
    <>
      <EpisodeThumbnail
        blur={hideSpoilers}
        image={episode.image}
        number={episode.number}
        progress={watched || progress > 0 ? progress : undefined}
        highlighted={highlighted}
        className="w-full"
      />
      <div className="min-w-0 px-0.5">
        <p className="truncate text-sm font-medium">
          {title ?? episodeLabel(episode)}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[
            title ? episodeLabel(episode) : null,
            status,
            episode.availableAudio.map(audioLabel).join(" / "),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </>
  )
  const className = cn(
    "flex flex-col gap-2 rounded-xl transition",
    watched && !highlighted && "opacity-70 hover:opacity-100",
    !audio && "opacity-50"
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
      className={cn(className, "hover:[&_img]:brightness-110")}
    >
      {content}
    </Link>
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
