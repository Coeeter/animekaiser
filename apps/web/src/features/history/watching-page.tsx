import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@animekaiser/ui/components/empty"
import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { Result, useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { MonitorPlay } from "lucide-react"
import type { ReactNode } from "react"
import { DataError } from "../../components/data-error"
import { PageHero } from "../../components/page-hero"
import { planningNewEpisodesAtom } from "../library/atoms"
import { NextSeasonCard, UpNextCard } from "../library/new-episodes-rows"
import { continueItemsAtom } from "./atoms"
import { ContinueWatchingCard } from "./continue-watching-row"

const gridClass =
  "grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:gap-x-4 lg:grid-cols-4 2xl:grid-cols-5"

export function WatchingPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 p-4 pb-8 md:p-6">
      <PageHero
        icon={MonitorPlay}
        kicker="Your library"
        title="Watching"
        description="Everything you're in the middle of, and what's next."
      />
      <ContinueSection />
      <PlanToWatchSection />
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl font-bold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function ContinueSection() {
  const atom = continueItemsAtom(50)
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)

  return (
    <Section
      title="Continue watching"
      description="Episodes you started, new episodes of shows you're watching, and the next season of what you just finished."
    >
      {Result.builder(result)
        .onInitialOrWaiting(() => <GridPending />)
        .onFailure(() => <DataError onRetry={refresh} />)
        .onSuccess((items) =>
          items.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MonitorPlay />
                </EmptyMedia>
                <EmptyTitle>Nothing in progress</EmptyTitle>
                <EmptyDescription>
                  Start an episode, or add shows you're watching to your list,
                  and they'll appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className={gridClass}>
              {items.map((entry) =>
                entry.kind === "resume" ? (
                  <ContinueWatchingCard
                    key={entry.item.malId}
                    item={entry.item}
                  />
                ) : entry.kind === "next" ? (
                  <UpNextCard key={entry.item.anime.malId} item={entry.item} />
                ) : (
                  <NextSeasonCard
                    key={entry.item.next.malId}
                    item={entry.item}
                  />
                )
              )}
            </div>
          )
        )
        .render()}
    </Section>
  )
}

function PlanToWatchSection() {
  const items = Result.builder(useAtomValue(planningNewEpisodesAtom))
    .onSuccess((value) => value)
    .orNull()

  if (!items || items.length === 0) return null

  return (
    <Section
      title="Airing from your plan to watch"
      description="Shows on your plan-to-watch list with episodes out now."
    >
      <div className={gridClass}>
        {items.map((item) => (
          <UpNextCard key={item.anime.malId} item={item} />
        ))}
      </div>
    </Section>
  )
}

function GridPending() {
  return (
    <div className={gridClass}>
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="aspect-video w-full rounded-2xl" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  )
}
