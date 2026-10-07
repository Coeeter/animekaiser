import type { LibraryEntry } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { Spinner } from "@animekaiser/ui/components/spinner"
import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import * as Effect from "effect/Effect"
import { Download, History } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { KaiserRpcClient } from "../../services/api-clients"
import { errorMessage } from "../../utils/error"
import { sessionAtom } from "../auth/atoms"
import { ClearWatchHistoryButton } from "../history/clear-watch-history"
import { settingsOpenAtom } from "./atoms"
import { toExportJson, toMalXml } from "./export-list"
import { AuthRequired, SettingCard, SettingHeading } from "./settings-shared"

const exportPageSize = 100

const fetchWholeListAtom = KaiserRpcClient.runtime.fn(() =>
  Effect.gen(function* () {
    const client = yield* KaiserRpcClient
    const entries: Array<LibraryEntry> = []
    for (let page = 1; ; page++) {
      const result = yield* client("GetLibraryPage", {
        sort: "title_asc",
        page,
        perPage: exportPageSize,
      })
      entries.push(...result.items)
      if (page >= result.totalPages) return entries
    }
  })
)

const download = (contents: string, filename: string, type: string) => {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function ExportListSetting() {
  const fetchWholeList = useAtomSet(fetchWholeListAtom, { mode: "promise" })
  const [pending, setPending] = useState<"json" | "xml" | null>(null)

  const exportAs = async (format: "json" | "xml") => {
    setPending(format)
    try {
      const entries = await fetchWholeList()
      const date = new Date()
      const stamp = date.toISOString().slice(0, 10)
      if (format === "json")
        download(
          toExportJson(entries, date),
          `animekaiser-list-${stamp}.json`,
          "application/json"
        )
      else
        download(
          toMalXml(entries),
          `animekaiser-list-${stamp}.xml`,
          "application/xml"
        )
      toast.success(`Exported ${entries.length} entries.`)
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to export your list"))
    } finally {
      setPending(null)
    }
  }

  return (
    <SettingCard id="privacy.export">
      <SettingHeading
        title="Export your list"
        description="Download every entry with its status, score, progress and notes. The MyAnimeList file imports into both MyAnimeList and AniList."
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pending !== null}
          onClick={() => void exportAs("xml")}
        >
          {pending === "xml" ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Download data-icon="inline-start" />
          )}
          MyAnimeList file (.xml)
        </Button>
        <Button
          variant="outline"
          disabled={pending !== null}
          onClick={() => void exportAs("json")}
        >
          {pending === "json" ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Download data-icon="inline-start" />
          )}
          JSON
        </Button>
      </div>
    </SettingCard>
  )
}

export function PrivacyPanel() {
  const sessionResult = useAtomValue(sessionAtom)
  const setSettingsOpen = useAtomSet(settingsOpenAtom)

  const isAuthenticated = Result.builder(sessionResult)
    .onSuccess((session) => session !== null)
    .orElse(() => false)

  if (!isAuthenticated) return <AuthRequired />

  return (
    <div className="flex flex-col gap-4">
      <ExportListSetting />

      <SettingCard id="privacy.history">
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

      <SettingCard id="privacy.clearHistory" className="border-destructive/40">
        <SettingHeading
          title="Clear watch history"
          description="Deletes every recorded episode and resume position. Your list and external providers are not affected."
          action={<ClearWatchHistoryButton variant="destructive" />}
        />
      </SettingCard>
    </div>
  )
}
