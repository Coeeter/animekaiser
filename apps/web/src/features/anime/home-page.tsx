import { Result, useAtomValue } from "@effect-atom/atom-react"
import type { AnimeHome } from "@workspace/domain"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { AnimeScrollRow } from "./anime-scroll-row"
import { homeAtom } from "./atoms"
import { HeroCarousel } from "./hero-carousel"

export function HomePage({ home }: { home: AnimeHome }) {
  const result = useAtomValue(homeAtom)
  if (Result.isWaiting(result)) return <HomePendingPage />

  const data = Result.match(result, {
    onInitial: () => home,
    onFailure: () => home,
    onSuccess: ({ value }) => value,
  })

  return (
    <div className="flex w-full flex-col gap-8 pb-8">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6 md:pt-6">
        <HeroCarousel items={data.trending.slice(0, 10)} />
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 md:px-6">
        <AnimeScrollRow
          title="This season"
          items={data.seasonal}
          moreHref="/discover?tab=seasonal"
        />

        <AnimeScrollRow
          title="Most popular"
          items={data.popular}
          moreHref="/discover?tab=popular"
        />
      </div>
    </div>
  )
}

export function HomePendingPage() {
  return (
    <div className="flex w-full flex-col gap-8 pb-8">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6 md:pt-6">
        <Skeleton className="aspect-[4/3] w-full rounded-2xl sm:aspect-[2.5/1] md:aspect-[3/1]" />
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 md:px-6">
        {Array.from({ length: 2 }, (_section, sectionIndex) => (
          <div key={sectionIndex} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 8 }, (_item, itemIndex) => (
                <div
                  key={itemIndex}
                  className="flex w-36 shrink-0 flex-col gap-2.5 sm:w-40 md:w-44"
                >
                  <Skeleton className="aspect-2/3 w-full rounded-xl" />
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
