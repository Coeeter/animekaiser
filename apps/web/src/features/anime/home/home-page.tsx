import { Skeleton } from "@animekaiser/ui/components/skeleton"
import { Result, useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import { DataError } from "../../../components/data-error"
import { sessionAtom } from "../../auth/atoms"
import { ContinueWatchingRow } from "../../history/continue-watching-row"
import { PlanToWatchAiringRow } from "../../library/new-episodes-rows"
import { AnimeScrollRow } from "../common/anime-scroll-row"
import { AiringTodayList } from "../schedule/airing-today"
import { homeAtom } from "./atoms"
import { HeroCarousel } from "./hero-carousel"
import {
  CompactList,
  GenreTiles,
  NewEpisodesRow,
  RankedList,
} from "./home-sections"

export function HomePage() {
  const result = useAtomValue(homeAtom)
  const refresh = useAtomRefresh(homeAtom)
  const sessionResult = useAtomValue(sessionAtom)

  const isAuthenticated = Result.builder(sessionResult)
    .onSuccess((session) => session !== null)
    .orElse(() => false)

  return Result.builder(result)
    .onInitialOrWaiting(() => <HomePendingPage />)
    .onFailure(() => (
      <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
        <DataError onRetry={refresh} />
      </div>
    ))
    .onSuccess((data) => (
      <div className="flex w-full flex-col gap-9 pb-10">
        <HeroCarousel items={data.trending.slice(0, 10)} />

        <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-10 px-4 md:px-6">
          {isAuthenticated ? <ContinueWatchingRow /> : null}
          {isAuthenticated ? <PlanToWatchAiringRow /> : null}
          <NewEpisodesRow />

          <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
            <RankedList
              eyebrow="Airing now"
              title="Top 10 this season"
              items={data.seasonal}
              more={{ to: "/discover", search: { tab: "seasonal", page: 1 } }}
            />
            <AiringTodayList />
          </div>

          <GenreTiles
            pool={[...data.seasonal, ...data.popular, ...data.topRated]}
          />

          <AnimeScrollRow
            eyebrow="Highest rated"
            title="Top anime"
            items={data.topRated}
            more={{ to: "/discover", search: { tab: "topRated", page: 1 } }}
          />

          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            <CompactList
              title="Most popular"
              items={data.popular}
              more={{ to: "/discover", search: { tab: "popular", page: 1 } }}
            />
            <CompactList
              title="Coming soon"
              items={data.upcoming}
              when
              more={{ to: "/discover", search: { tab: "upcoming", page: 1 } }}
            />
            <CompactList
              title="Best of the season"
              items={[...data.seasonal].sort(
                (left, right) =>
                  (right.averageScore ?? 0) - (left.averageScore ?? 0)
              )}
              more={{ to: "/discover", search: { tab: "seasonal", page: 1 } }}
            />
          </div>
        </div>
      </div>
    ))
    .render()
}

export function HomePendingPage() {
  return (
    <div className="flex w-full flex-col gap-9 pb-10">
      <Skeleton className="aspect-video w-full rounded-none md:aspect-auto md:h-[min(72vh,620px)] md:min-h-[460px]" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-9 px-4 md:px-6">
        {Array.from({ length: 2 }, (_section, sectionIndex) => (
          <div key={sectionIndex} className="flex flex-col gap-3">
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-36" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex gap-3 overflow-hidden md:gap-4">
              {Array.from({ length: 8 }, (_item, itemIndex) => (
                <div
                  key={itemIndex}
                  className="flex w-32 shrink-0 flex-col gap-2.5 sm:w-36 md:w-40 lg:w-44"
                >
                  <Skeleton className="aspect-2/3 w-full rounded-2xl" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
