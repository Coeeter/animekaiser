import type { ContinueWatchingItem } from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import { Button } from "@animekaiser/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@animekaiser/ui/components/empty"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { cn } from "@animekaiser/ui/lib/utils"
import {
  Result,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  Play,
  SearchX,
  Server,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { DataError } from "../../components/data-error"
import { DebouncedSearchInput } from "../../components/debounced-search-input"
import { PageHero } from "../../components/page-hero"
import { AnimeTitle } from "../anime/common/anime-title"
import { formatTime, providerLabel } from "../streaming/player-format"
import {
  clearWatchHistoryEntryAtom,
  watchHistoryPageAtom,
  watchHistoryReactivityKeys,
} from "./atoms"
import { ClearWatchHistoryButton } from "./clear-watch-history"
import type { WatchHistorySearch } from "./search"

const perPage = 24

const percentWatched = (item: ContinueWatchingItem) => {
  if (item.status === "completed") return 100
  if (!item.durationSeconds || item.durationSeconds <= 0) return 0
  return Math.min(
    100,
    Math.round((item.positionSeconds / item.durationSeconds) * 100)
  )
}

const formatWatchedAt = (value: Date) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value)

export function WatchHistoryPage({ search }: { search: WatchHistorySearch }) {
  const navigate = useNavigate()
  const atom = watchHistoryPageAtom(
    search.page,
    perPage,
    search.q?.trim() || undefined
  )
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 pb-8 md:p-6">
      <PageHero
        icon={History}
        kicker="Your activity"
        title="Watch history"
        description="Episodes you have played, and where you left off in each one."
      >
        <ClearWatchHistoryButton onCleared={refresh} />
      </PageHero>

      <DebouncedSearchInput
        committed={search.q?.trim() ?? ""}
        placeholder="Search your history…"
        label="Search your watch history"
        onCommit={(q) =>
          void navigate({
            to: "/watch-history",
            search: { q, page: 1 },
            replace: true,
          })
        }
      />

      {Result.builder(result)
        .onInitialOrWaiting(() => <WatchHistoryPending />)
        .onFailure(() => <DataError onRetry={refresh} />)
        .onSuccess((page) =>
          page.items.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {search.q ? <SearchX /> : <History />}
                </EmptyMedia>
                <EmptyTitle>
                  {search.q
                    ? `Nothing matches \u201c${search.q}\u201d`
                    : "Nothing watched yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {search.q
                    ? "Try a different spelling, or clear the search to see everything you have watched."
                    : "Play an episode and it will show up here so you can pick up where you left off."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {page.items.map((item) => (
                <WatchHistoryRow
                  key={`${item.malId}-${item.episode}`}
                  item={item}
                  onCleared={refresh}
                />
              ))}
              <WatchHistoryPagination
                search={search}
                hasNextPage={page.hasNextPage}
              />
            </div>
          )
        )
        .render()}
    </div>
  )
}

function WatchHistoryRow({
  item,
  onCleared,
}: {
  item: ContinueWatchingItem
  onCleared: () => void
}) {
  const clearEntry = useAtomSet(clearWatchHistoryEntryAtom, {
    mode: "promise",
  })
  const percent = percentWatched(item)
  const completed = item.status === "completed"

  const clear = async () => {
    try {
      await clearEntry({
        payload: { malId: item.malId },
        reactivityKeys: [watchHistoryReactivityKeys.all],
      })
      onCleared()
      toast.success("Removed from your history")
    } catch {
      toast.error("Unable to remove this entry")
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card/70 p-2.5 transition hover:border-primary/40">
      <Link
        to="/watch/$malId/$provider/$episodeId"
        params={{
          malId: item.malId,
          provider: item.provider,
          episodeId: item.episodeId,
        }}
        search={{ audio: item.audio, serverId: item.serverId ?? undefined }}
        className="group relative aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-muted sm:w-36"
      >
        {item.anime.coverImage ? (
          <img
            src={item.anime.coverImage}
            alt=""
            className="size-full object-cover object-center"
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <span className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition group-hover:opacity-100">
          <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
            <Play className="size-4 fill-current" />
          </span>
        </span>
        <span className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
          <span
            className={cn(
              "block h-full",
              completed ? "bg-emerald-400" : "bg-primary"
            )}
            style={{ width: `${percent}%` }}
          />
        </span>
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          to="/series/$id"
          params={{ id: item.malId }}
          className="line-clamp-1 text-sm font-medium hover:text-primary"
        >
          <AnimeTitle title={item.anime.title} />
        </Link>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          Episode {item.episode}
          {item.durationSeconds
            ? ` · ${formatTime(item.positionSeconds)} / ${formatTime(item.durationSeconds)}`
            : ` · ${formatTime(item.positionSeconds)}`}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {completed ? (
            <Badge variant="outline">
              <CheckCircle2 data-icon="inline-start" />
              Completed
            </Badge>
          ) : (
            <Badge variant="secondary">{percent}% watched</Badge>
          )}
          <Badge variant="outline">{providerLabel(item.provider)}</Badge>
          {item.serverName ? (
            <Badge variant="outline">
              <Server data-icon="inline-start" />
              {item.serverName}
            </Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {formatWatchedAt(item.updatedAt)}
          </span>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Remove from history"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => void clear()}
      >
        <Trash2 />
      </Button>
    </div>
  )
}

function WatchHistoryPagination({
  search,
  hasNextPage,
}: {
  search: WatchHistorySearch
  hasNextPage: boolean
}) {
  const page = search.page
  if (page <= 1 && !hasNextPage) return null

  return (
    <nav className="flex items-center justify-between gap-3 rounded-2xl border bg-card/60 p-3">
      {page <= 1 ? (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft data-icon="inline-start" />
          Previous
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link to="/watch-history" search={{ q: search.q, page: page - 1 }}>
            <ChevronLeft data-icon="inline-start" />
            Previous
          </Link>
        </Button>
      )}
      <span className="text-sm text-muted-foreground">Page {page}</span>
      {hasNextPage ? (
        <Button asChild variant="outline" size="sm">
          <Link to="/watch-history" search={{ q: search.q, page: page + 1 }}>
            Next
            <ChevronRight data-icon="inline-end" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Next
          <ChevronRight data-icon="inline-end" />
        </Button>
      )}
    </nav>
  )
}

function WatchHistoryPending() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-24 rounded-2xl" />
      ))}
    </div>
  )
}
