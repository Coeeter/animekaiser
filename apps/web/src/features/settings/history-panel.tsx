import { Button } from "@animekaiser/ui/components/button"
import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { History } from "lucide-react"
import { sessionAtom } from "../auth/atoms"
import { ClearWatchHistoryButton } from "../history/clear-watch-history"
import { settingsOpenAtom } from "./atoms"
import { AuthRequired, PanelCard } from "./settings-shared"

export function HistoryPanel() {
  const sessionResult = useAtomValue(sessionAtom)
  const setSettingsOpen = useAtomSet(settingsOpenAtom)

  const isAuthenticated = Result.builder(sessionResult)
    .onSuccess((session) => session !== null)
    .orElse(() => false)

  if (!isAuthenticated) return <AuthRequired />

  return (
    <div className="flex flex-col gap-4">
      <PanelCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-semibold">Watch history</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Episodes you have played and where you stopped in each one. This
              is what powers Continue watching on the home page.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link
              to="/watch-history"
              search={{ page: 1 }}
              onClick={() => setSettingsOpen(false)}
            >
              <History data-icon="inline-start" />
              View history
            </Link>
          </Button>
        </div>
      </PanelCard>

      <PanelCard className="border-destructive/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-semibold">Clear watch history</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Deletes every recorded episode and resume position. Your list and
              external providers are not affected.
            </p>
          </div>
          <ClearWatchHistoryButton variant="destructive" />
        </div>
      </PanelCard>
    </div>
  )
}
