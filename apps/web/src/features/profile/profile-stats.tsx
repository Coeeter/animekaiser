import type {
  LibraryStatus,
  ProfileActivityStats,
  ProfileLibraryStats,
} from "@animekaiser/domain"
import { Badge } from "@animekaiser/ui/components/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@animekaiser/ui/components/tooltip"
import { cn } from "@animekaiser/ui/lib/utils"
import { Link } from "@tanstack/react-router"
import { Flame, ListVideo, Star, Timer } from "lucide-react"
import type { ReactNode } from "react"
import { StatTile } from "../../components/stat-tile"

const statusMeta: Record<LibraryStatus, { label: string; className: string }> =
  {
    watching: { label: "Watching", className: "bg-emerald-500" },
    completed: { label: "Completed", className: "bg-primary" },
    rewatching: { label: "Rewatching", className: "bg-sky-500" },
    paused: { label: "Paused", className: "bg-amber-500" },
    planning: { label: "Planning", className: "bg-violet-500" },
    dropped: { label: "Dropped", className: "bg-rose-500" },
  }

const statusOrder: ReadonlyArray<LibraryStatus> = [
  "watching",
  "completed",
  "rewatching",
  "paused",
  "planning",
  "dropped",
]

const formatDuration = (minutes: number) => {
  if (minutes <= 0) return "0h"

  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${minutes}m`
}

const formatScore = (score: number | null) =>
  score === null ? "—" : (score / 10).toFixed(1)

export function ProfileStatsSections({
  stats,
  activity,
}: {
  stats: ProfileLibraryStats | null
  activity: ProfileActivityStats | null
}) {
  const hasLibrary = (stats?.totalTitles ?? 0) > 0

  if (!hasLibrary && (activity?.episodesPlayed ?? 0) === 0) {
    return (
      <section className="rounded-3xl border border-dashed p-10 text-center">
        <p className="font-heading text-lg font-semibold">
          Nothing to show yet
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Statistics appear once titles are added to the list or episodes are
          watched.
        </p>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <StatTiles stats={stats} activity={activity} />

      {stats ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <StatusBreakdown stats={stats} />
          <ScoreDistribution stats={stats} />
        </div>
      ) : null}

      {activity ? <ActivityStrip stats={activity} /> : null}

      {stats && stats.topRated.length > 0 ? <TopRated stats={stats} /> : null}
    </div>
  )
}

function StatTiles({
  stats,
  activity,
}: {
  stats: ProfileLibraryStats | null
  activity: ProfileActivityStats | null
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats ? (
        <>
          <StatTile
            icon={ListVideo}
            label="Titles"
            value={stats.totalTitles.toLocaleString()}
            hint={`${stats.byStatus.completed.toLocaleString()} completed`}
          />
          <StatTile
            icon={Timer}
            label="Episodes"
            value={stats.episodesWatched.toLocaleString()}
            hint={`≈ ${formatDuration(stats.estimatedMinutes)} watched`}
          />
          <StatTile
            icon={Star}
            label="Mean score"
            value={formatScore(stats.meanScore)}
            hint={
              stats.scoredCount > 0
                ? `${stats.scoredCount.toLocaleString()} rated`
                : "Nothing rated yet"
            }
          />
        </>
      ) : null}
      {activity ? (
        <StatTile
          icon={Flame}
          label="Current streak"
          value={`${activity.currentStreakDays}d`}
          hint={`Best ${activity.longestStreakDays}d`}
        />
      ) : null}
    </div>
  )
}

function StatPanel({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card/70 p-4 md:p-5">
      <div>
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function StatusBreakdown({ stats }: { stats: ProfileLibraryStats }) {
  const total = stats.totalTitles

  return (
    <StatPanel
      title="List breakdown"
      description={`${total.toLocaleString()} titles tracked`}
    >
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {statusOrder.map((status) => {
          const count = stats.byStatus[status]
          if (count === 0 || total === 0) return null

          return (
            <span
              key={status}
              className={statusMeta[status].className}
              style={{ width: `${(count / total) * 100}%` }}
            />
          )
        })}
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        {statusOrder.map((status) => {
          const meta = statusMeta[status]
          const count = stats.byStatus[status]
          const percent = total === 0 ? 0 : Math.round((count / total) * 100)

          return (
            <li key={status} className="flex items-center gap-2">
              <span
                className={cn("size-2 shrink-0 rounded-full", meta.className)}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {meta.label}
              </span>
              <span className="text-xs font-semibold tabular-nums">
                {count.toLocaleString()}
              </span>
              <span className="w-9 text-right text-[11px] text-muted-foreground tabular-nums">
                {percent}%
              </span>
            </li>
          )
        })}
      </ul>
    </StatPanel>
  )
}

function ScoreDistribution({ stats }: { stats: ProfileLibraryStats }) {
  const peak = Math.max(...stats.scoreDistribution.map((bar) => bar.count), 1)

  if (stats.scoredCount === 0) {
    return (
      <StatPanel title="Score distribution">
        <p className="py-6 text-center text-sm text-muted-foreground">
          No titles have been rated yet.
        </p>
      </StatPanel>
    )
  }

  return (
    <StatPanel
      title="Score distribution"
      description={`${stats.scoredCount.toLocaleString()} rated · mean ${formatScore(stats.meanScore)}`}
    >
      <TooltipProvider>
        <div className="flex h-32 items-end gap-1.5">
          {stats.scoreDistribution.map((bar) => (
            <Tooltip key={bar.score}>
              <TooltipTrigger asChild>
                <div className="flex h-full flex-1 flex-col justify-end gap-1.5">
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-colors",
                      bar.count > 0
                        ? "bg-primary hover:bg-primary/80"
                        : "bg-muted"
                    )}
                    style={{
                      height: `${Math.max((bar.count / peak) * 100, 2)}%`,
                    }}
                  />
                  <span className="text-center text-[10px] text-muted-foreground tabular-nums">
                    {bar.score}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {bar.count.toLocaleString()} rated {bar.score}/10
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </StatPanel>
  )
}

function ActivityStrip({ stats }: { stats: ProfileActivityStats }) {
  const busiest = Math.max(...stats.activity.map((day) => day.episodes), 1)

  const intensity = (episodes: number) => {
    if (episodes === 0) return "bg-muted"
    const ratio = episodes / busiest
    if (ratio > 0.66) return "bg-primary"
    if (ratio > 0.33) return "bg-primary/70"
    return "bg-primary/40"
  }

  const weeks: Array<Array<(typeof stats.activity)[number]>> = []
  for (let index = 0; index < stats.activity.length; index += 7) {
    weeks.push(stats.activity.slice(index, index + 7))
  }

  const monthLabels = weeks.map((week, index) => {
    const first = week[0]
    if (!first) return null

    const date = new Date(`${first.date}T00:00:00Z`)
    const previous = weeks[index - 1]?.[0]
    const previousMonth = previous
      ? new Date(`${previous.date}T00:00:00Z`).getUTCMonth()
      : null

    return date.getUTCMonth() === previousMonth
      ? null
      : date.toLocaleString(undefined, { month: "short", timeZone: "UTC" })
  })

  return (
    <StatPanel
      title="Activity"
      description={`${stats.episodesPlayed.toLocaleString()} episodes played across ${stats.titlesStarted.toLocaleString()} titles · ${formatDuration(stats.trackedMinutes)} tracked`}
    >
      <TooltipProvider>
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
          }}
        >
          {monthLabels.map((label, index) => (
            <span
              key={weeks[index]?.[0]?.date ?? index}
              className="h-4 overflow-visible text-[10px] leading-4 whitespace-nowrap text-muted-foreground"
            >
              {label}
            </span>
          ))}

          {weeks.map((week) => (
            <div key={week[0]?.date} className="grid grid-rows-7 gap-1">
              {week.map((day) => (
                <Tooltip key={day.date}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "aspect-square w-full rounded-[3px]",
                        intensity(day.episodes)
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {day.episodes === 0
                      ? `No episodes on ${day.date}`
                      : `${day.episodes} episode${day.episodes === 1 ? "" : "s"} on ${day.date}`}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
      </TooltipProvider>

      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        <span>Less</span>
        <span className="size-3 rounded-[3px] bg-muted" />
        <span className="size-3 rounded-[3px] bg-primary/40" />
        <span className="size-3 rounded-[3px] bg-primary/70" />
        <span className="size-3 rounded-[3px] bg-primary" />
        <span>More</span>
      </div>
    </StatPanel>
  )
}

function TopRated({ stats }: { stats: ProfileLibraryStats }) {
  return (
    <StatPanel title="Highest rated" description="Top scores in this list">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {stats.topRated.map((title) => (
          <Link
            key={title.malId}
            to="/series/$id"
            params={{ id: title.malId }}
            preload="intent"
            className="group flex min-w-0 flex-col gap-2"
          >
            <div className="relative aspect-2/3 overflow-hidden rounded-xl bg-muted ring-1 ring-white/10 transition group-hover:ring-primary/50">
              {title.coverImage ? (
                <img
                  src={title.coverImage}
                  alt=""
                  className="size-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
              <Badge className="absolute top-1.5 left-1.5 gap-1 border-0 bg-black/70 text-white">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                {(title.score / 10).toFixed(1)}
              </Badge>
            </div>
            <p className="line-clamp-2 text-xs leading-4 font-medium transition-colors group-hover:text-primary">
              {title.title}
            </p>
          </Link>
        ))}
      </div>
    </StatPanel>
  )
}
