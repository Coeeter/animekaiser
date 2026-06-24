import { Skeleton } from "@workspace/ui/components/skeleton"

export function SeriesCatalogPending() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2.5">
            <Skeleton className="aspect-2/3 w-full rounded-xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-card/80 p-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  )
}
