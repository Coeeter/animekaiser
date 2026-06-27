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
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { PlayCircle, RadioTower, TvMinimalPlay } from "lucide-react"
import { useState } from "react"
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

const preferredAudio = (
  episode: StreamProviderEpisodes["episodes"][number]
): StreamAudio | null => {
  if (episode.availableAudio.includes("sub")) return "sub"
  if (episode.availableAudio.includes("dub")) return "dub"
  return null
}

export function EpisodesPanel({ anime }: { anime: AnimeDetail }) {
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
          onValueChange={(value) =>
            setSelectedProvider(decodeProviderId(value))
          }
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

      <ProviderEpisodes anime={anime} provider={currentProvider} />
    </div>
  )
}

function ProviderEpisodes({
  anime,
  provider,
}: {
  anime: AnimeDetail
  provider: StreamProviderEpisodes
}) {
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

  return (
    <div className="grid gap-2">
      {provider.episodes.map((episode) => {
        const audio = preferredAudio(episode)
        return (
          <div
            key={episode.id}
            className={cn(
              "flex flex-col gap-3 rounded-xl border bg-card/80 p-3 transition hover:bg-accent sm:flex-row sm:items-center sm:justify-between",
              !audio && "opacity-60"
            )}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Episode {episode.number}</Badge>
                {episode.availableAudio.map((item) => (
                  <Badge key={item} variant="outline">
                    {audioLabel(item)}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-medium">
                {episode.title}
              </p>
              {episode.japaneseTitle ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {episode.japaneseTitle}
                </p>
              ) : null}
            </div>
            {audio ? (
              <Button asChild size="sm">
                <Link
                  to="/watch/$malId/$provider/$episodeId"
                  params={{
                    malId: anime.malId,
                    provider: provider.provider,
                    episodeId: episode.id,
                  }}
                  search={{ audio }}
                >
                  <PlayCircle data-icon="inline-start" />
                  Watch
                </Link>
              </Button>
            ) : (
              <Button size="sm" disabled>
                No streams
              </Button>
            )}
          </div>
        )
      })}
    </div>
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
