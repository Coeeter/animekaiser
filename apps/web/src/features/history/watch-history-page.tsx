import type { ContinueWatchingItem } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@animekaiser/ui/components/dropdown-menu"
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
  MoreHorizontal,
  SearchX,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { DataError } from "../../components/data-error"
import { DebouncedSearchInput } from "../../components/debounced-search-input"
import { PageHero } from "../../components/page-hero"
import { isStaleResult, useLastSuccess } from "../../hooks/use-last-success"
import { AnimeTitle } from "../anime/common/anime-title"
import {
  clearWatchHistoryEntryAtom,
  watchHistoryClearKeys,
  watchHistoryPageAtom,
} from "./atoms"
import { ClearWatchHistoryButton } from "./clear-watch-history"
import type { WatchHistorySearch } from "./search"

const perPage = 40

const percentWatched = (item: ContinueWatchingItem) => {
  if (item.status === "completed") return 100
  if (!item.durationSeconds) return 0
  return Math.min(
    100,
    Math.round((item.positionSeconds / item.durationSeconds) * 100)
  )
}

const progressLabel = (item: ContinueWatchingItem) => {
  if (item.status === "completed") return "Watched"
  if (!item.durationSeconds) return "Started"
  const minutes = Math.max(
    1,
    Math.round((item.durationSeconds - item.positionSeconds) / 60)
  )
  return `${minutes} min left`
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

const dayLabel = (date: Date) => {
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 864e5)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7)
    return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date)
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date)
}

const timeLabel = (date: Date) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)

const groupByDay = (items: ReadonlyArray<ContinueWatchingItem>) => {
  const groups: Array<{ label: string; items: Array<ContinueWatchingItem> }> =
    []
  for (const item of items) {
    const label = dayLabel(item.updatedAt)
    const last = groups.at(-1)
    if (last?.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}

export function WatchHistoryPage({ search }: { search: WatchHistorySearch }) {
  const navigate = useNavigate()
  const atom = watchHistoryPageAtom(
    search.page,
    perPage,
    search.q?.trim() || undefined
  )
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)
  const page = useLastSuccess(result)
  const stale = isStaleResult(result, page)

  const failure = Result.builder(result)
    .onFailure(() => <DataError onRetry={refresh} />)
    .orNull()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 pb-8 md:p-6">
      <PageHero
        icon={History}
        kicker="Your activity"
        title="Watch history"
        description="Every episode you've played, newest first."
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

      {failure ??
        (page ? (
          page.items.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {search.q ? <SearchX /> : <History />}
                </EmptyMedia>
                <EmptyTitle>
                  {search.q
                    ? `Nothing matches “${search.q}”`
                    : "Nothing watched yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {search.q
                    ? "Try a different spelling, or clear the search to see everything you have watched."
                    : "Play an episode and it will show up here."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div
              className={cn(
                "flex flex-col gap-8 transition-opacity",
                stale && "opacity-60"
              )}
            >
              {groupByDay(page.items).map((group) => (
                <section key={group.label} className="flex flex-col gap-2">
                  <h2 className="px-2 text-sm font-semibold text-muted-foreground">
                    {group.label}
                  </h2>
                  <ul className="flex flex-col">
                    {group.items.map((item) => (
                      <HistoryRow
                        key={`${item.malId}-${item.episode}-${item.updatedAt.getTime()}`}
                        item={item}
                      />
                    ))}
                  </ul>
                </section>
              ))}
              <WatchHistoryPagination
                search={search}
                hasNextPage={page.hasNextPage}
              />
            </div>
          )
        ) : (
          <WatchHistoryPending />
        ))}
    </div>
  )
}

function HistoryRow({ item }: { item: ContinueWatchingItem }) {
  const clearEntry = useAtomSet(clearWatchHistoryEntryAtom, {
    mode: "promise",
  })
  const percent = percentWatched(item)
  const image = item.episodeImage ?? item.anime.coverImage

  const removeShow = async () => {
    try {
      await clearEntry({
        payload: { malId: item.malId },
        reactivityKeys: watchHistoryClearKeys,
      })
      toast.success("Removed from your history")
    } catch {
      toast.error("Unable to remove this show")
    }
  }

  return (
    <li className="group relative flex items-center gap-4 rounded-2xl p-2 transition hover:bg-accent/60">
      <Link
        to="/watch/$malId/$provider/$episodeId"
        params={{
          malId: item.malId,
          provider: item.provider,
          episodeId: item.episodeId,
        }}
        search={{ audio: item.audio, serverId: item.serverId ?? undefined }}
        className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        aria-label={`Play episode ${item.episode}`}
      />
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-muted sm:w-40">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="size-full object-cover"
          />
        ) : null}
        <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
          <span
            className="block h-full bg-primary"
            style={{ width: `${percent}%` }}
          />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="line-clamp-1 font-medium">
          <AnimeTitle title={item.anime.title} />
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Episode {item.episode}
          <span aria-hidden>·</span>
          {item.status === "completed" ? (
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              Watched
            </span>
          ) : (
            progressLabel(item)
          )}
        </p>
      </div>
      <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:block">
        {timeLabel(item.updatedAt)}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative z-10 shrink-0 text-muted-foreground"
            aria-label="History options"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => void removeShow()}
          >
            <Trash2 />
            Remove <AnimeTitle title={item.anime.title} /> from history
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
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
    <nav className="flex items-center justify-between gap-3">
      {page <= 1 ? (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft data-icon="inline-start" />
          Newer
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link to="/watch-history" search={{ q: search.q, page: page - 1 }}>
            <ChevronLeft data-icon="inline-start" />
            Newer
          </Link>
        </Button>
      )}
      <span className="text-sm text-muted-foreground">Page {page}</span>
      {hasNextPage ? (
        <Button asChild variant="outline" size="sm">
          <Link to="/watch-history" search={{ q: search.q, page: page + 1 }}>
            Older
            <ChevronRight data-icon="inline-end" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Older
          <ChevronRight data-icon="inline-end" />
        </Button>
      )}
    </nav>
  )
}

function WatchHistoryPending() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="mx-2 h-4 w-20" />
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 p-2">
          <Skeleton className="aspect-video w-32 shrink-0 rounded-xl sm:w-40" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
