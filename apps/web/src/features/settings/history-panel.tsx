import { Button } from "@animekaiser/ui/components/button"
import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { History } from "lucide-react"
import { sessionAtom } from "../auth/atoms"
import { ClearWatchHistoryButton } from "../history/clear-watch-history"
import { settingsOpenAtom } from "./atoms"
import { AuthRequired, SettingCard, SettingHeading } from "./settings-shared"

export function HistoryPanel() {
  const sessionResult = useAtomValue(sessionAtom)
  const setSettingsOpen = useAtomSet(settingsOpenAtom)

  const isAuthenticated = Result.builder(sessionResult)
    .onSuccess((session) => session !== null)
    .orElse(() => false)

  if (!isAuthenticated) return <AuthRequired />

  return (
    <div className="flex flex-col gap-4">
      <SettingCard id="history.watch">
        <SettingHeading
          title="Watch history"
          description="Episodes you have played and where you stopped in each one. This is what powers Continue watching on the home page."
          action={
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
          }
        />
      </SettingCard>

      <SettingCard id="history.clear" className="border-destructive/40">
        <SettingHeading
          title="Clear watch history"
          description="Deletes every recorded episode and resume position. Your list and external providers are not affected."
          action={<ClearWatchHistoryButton variant="destructive" />}
        />
      </SettingCard>
    </div>
  )
}
