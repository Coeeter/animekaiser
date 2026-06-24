import {
  Result,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ListRestart, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { PageHero } from "../../components/page-hero"
import { retrySyncAtom, syncEventsAtom } from "./atoms"
import type { SyncActivitySearch } from "./search"

export function SyncActivityPage({ page }: SyncActivitySearch) {
  const queryAtom = syncEventsAtom(page, 50)
  const result = useAtomValue(queryAtom)
  const refresh = useAtomRefresh(queryAtom)
  const retry = useAtomSet(retrySyncAtom, { mode: "promise" })
  const retryEvent = async (id: string) => {
    try {
      await retry({ payload: { eventIds: [id], target: { type: "original" } } })
      refresh()
      toast.success("Retry queued")
    } catch {
      toast.error("Unable to retry sync")
    }
  }
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-7 p-4 pb-10 md:p-6">
      <nav className="flex gap-2 text-sm text-muted-foreground">
        <Link
          to="/my-list"
          search={{ status: "all", sort: "updated_desc", page: 1 }}
        >
          My List
        </Link>
        <span>/</span>
        <span className="text-foreground">Sync Activity</span>
      </nav>
      <PageHero
        icon={ListRestart}
        kicker="External lists"
        title="Sync activity"
        description="Review durable outbound changes and retry failed provider updates."
      />
      {Result.match(result, {
        onInitial: () => (
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        ),
        onFailure: () => (
          <div className="rounded-xl border p-10 text-center text-destructive">
            Unable to load sync activity.
          </div>
        ),
        onSuccess: ({ value: data }) =>
          data.items.length ? (
            <div className="divide-y overflow-hidden rounded-xl border bg-card">
              {data.items.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center gap-4 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{event.title}</p>
                      <Badge variant="outline" className="uppercase">
                        {event.provider}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.action} · MAL {event.malId} ·{" "}
                      {event.createdAt.toLocaleString()}
                    </p>
                    {event.errorMessage ? (
                      <p className="mt-1 text-sm text-destructive">
                        {event.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    variant={
                      event.status === "failed"
                        ? "destructive"
                        : event.status === "completed"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {event.status}
                  </Badge>
                  {event.status === "failed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void retryEvent(event.id)}
                    >
                      <RefreshCw />
                      Retry
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              No sync events yet.
            </div>
          ),
      })}
    </main>
  )
}
