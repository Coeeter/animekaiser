import type { LibraryEntry } from "@animekaiser/domain"
import { LibrarySort } from "@animekaiser/domain"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@animekaiser/ui/components/avatar"
import { Badge } from "@animekaiser/ui/components/badge"
import { Button } from "@animekaiser/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@animekaiser/ui/components/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@animekaiser/ui/components/select"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { cn } from "@animekaiser/ui/lib/utils"
import { Result, useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { Link, useNavigate } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  UserRoundX,
} from "lucide-react"
import { DataError } from "../../components/data-error"
import { AnimeTitle } from "../anime/common/anime-title"
import { publicLibraryAtom } from "./atoms"
import { libraryStatuses } from "./constants"
import type { MyListSearch } from "./search"

const decodeLibrarySort = Schema.decodeUnknownSync(LibrarySort)

const sortLabels: Record<LibrarySort, string> = {
  updated_desc: "Recently updated",
  updated_asc: "Oldest updated",
  title_asc: "Title A-Z",
  score_desc: "Highest score",
  progress_desc: "Most progress",
}

const perPage = 30

const progressLabel = (entry: LibraryEntry) =>
  entry.anime.episodes
    ? `${entry.progress}/${entry.anime.episodes} episodes`
    : `${entry.progress} episodes`

const progressPercent = (entry: LibraryEntry) => {
  const total = entry.anime.episodes
  if (!total || total <= 0) return null
  return Math.min(100, Math.round((entry.progress / total) * 100))
}

export function PublicListPage({
  username,
  search,
}: {
  username: string
  search: MyListSearch
}) {
  const navigate = useNavigate()
  const atom = publicLibraryAtom({
    username,
    asPublic: true,
    status: search.status === "all" ? undefined : search.status,
    sort: search.sort,
    page: search.page,
    perPage,
    query: search.q?.trim() || undefined,
  })
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)

  const setSearch = (patch: Partial<MyListSearch>) => {
    void navigate({
      to: "/list/$username",
      params: { username },
      search: { ...search, ...patch },
      replace: true,
    })
  }

  return Result.builder(result)
    .onInitialOrWaiting(() => <PublicListPending />)
    .onFailure(() => (
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <DataError onRetry={refresh} />
      </div>
    ))
    .onSuccess((data) => {
      if (data.type !== "public") return <ListUnavailable type={data.type} />

      const { page } = data

      return (
        <>
          <title>{`${data.username}'s list | AnimeKaiser`}</title>
          <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 pb-10 md:p-6">
            <header className="flex flex-wrap items-center gap-3">
              <Avatar className="size-12">
                <AvatarImage
                  src={data.image ?? undefined}
                  alt={data.username}
                />
                <AvatarFallback>
                  {data.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-heading text-2xl font-black tracking-tight">
                  {data.username}'s list
                </h1>
                <p className="text-sm text-muted-foreground">
                  {page.total.toLocaleString()} titles
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/u/$username" params={{ username }} search={{}}>
                  View profile
                </Link>
              </Button>
            </header>

            <div className="flex flex-wrap gap-2">
              <Select
                value={search.status}
                onValueChange={(value) =>
                  setSearch({
                    status: value as MyListSearch["status"],
                    page: 1,
                  })
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {libraryStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={search.sort}
                onValueChange={(value) =>
                  setSearch({ sort: decodeLibrarySort(value), page: 1 })
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sortLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {page.items.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {page.items.map((entry) => (
                  <PublicListCard key={entry.malId} entry={entry} />
                ))}
              </div>
            ) : (
              <Empty className="border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Bookmark />
                  </EmptyMedia>
                  <EmptyTitle>Nothing here yet</EmptyTitle>
                  <EmptyDescription>
                    This list has no titles matching your filters.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            {page.totalPages > 1 ? (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page.page <= 1}
                  onClick={() => setSearch({ page: page.page - 1 })}
                >
                  <ChevronLeft data-icon="inline-start" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page.page} of {page.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page.page >= page.totalPages}
                  onClick={() => setSearch({ page: page.page + 1 })}
                >
                  Next
                  <ChevronRight data-icon="inline-end" />
                </Button>
              </div>
            ) : null}
          </main>
        </>
      )
    })
    .render()
}

function PublicListCard({ entry }: { entry: LibraryEntry }) {
  const percent = progressPercent(entry)
  const complete = entry.status === "completed"
  const status = libraryStatuses.find((item) => item.value === entry.status)

  return (
    <article className="group flex gap-3 rounded-2xl border bg-card/70 p-2.5 transition hover:border-primary/40">
      <Link
        to="/series/$id"
        params={{ id: entry.malId }}
        preload="intent"
        className="relative aspect-2/3 w-20 shrink-0 overflow-hidden rounded-xl bg-muted"
      >
        {entry.anime.coverImage ? (
          <img
            src={entry.anime.coverImage}
            alt=""
            className="size-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : null}
        {percent !== null ? (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <span
              className={cn(
                "block h-full",
                complete ? "bg-emerald-400" : "bg-primary"
              )}
              style={{ width: `${percent}%` }}
            />
          </span>
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Link
          to="/series/$id"
          params={{ id: entry.malId }}
          preload="intent"
          className="line-clamp-2 text-sm font-medium transition-colors hover:text-primary"
        >
          <AnimeTitle title={entry.anime.title} />
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {progressLabel(entry)}
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5">
          {status ? <Badge variant="secondary">{status.label}</Badge> : null}
          {entry.score !== null ? (
            <Badge variant="outline">{(entry.score / 10).toFixed(1)}/10</Badge>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function ListUnavailable({ type }: { type: "private" | "not_found" }) {
  const isPrivate = type === "private"

  return (
    <main className="flex min-h-[70svh] items-center justify-center p-6">
      <Empty className="max-w-lg border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {isPrivate ? <LockKeyhole /> : <UserRoundX />}
          </EmptyMedia>
          <EmptyTitle>
            {isPrivate ? "This list is private" : "List not found"}
          </EmptyTitle>
          <EmptyDescription>
            {isPrivate
              ? "This user has chosen not to share their list."
              : "The username may have changed or the account no longer exists."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  )
}

function PublicListPending() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <Skeleton className="h-14 w-64 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
