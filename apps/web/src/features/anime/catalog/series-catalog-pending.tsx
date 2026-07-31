import { Skeleton } from "@animekaiser/ui/components/skeleton"

export function SeriesCatalogPending() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:gap-x-4 md:gap-y-6 lg:grid-cols-6">
        {Array.from({ length: 24 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2.5">
            <Skeleton className="aspect-2/3 w-full rounded-2xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl border bg-card/80 p-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  )
}
