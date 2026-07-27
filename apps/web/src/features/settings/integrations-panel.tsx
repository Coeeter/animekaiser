import { Badge } from "@animekaiser/ui/components/badge"
import { Button } from "@animekaiser/ui/components/button"
import {
  Result,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { Link } from "@tanstack/react-router"
import { Download, Link2, Unlink } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { DataError } from "../../components/data-error"
import { apiUrl } from "../../services/api-clients"
import { errorMessage } from "../../utils/error"
import type { AppUser } from "../auth/user"
import {
  accountHealthAtom,
  disconnectExternalAccountAtom,
} from "../integrations/atoms"
import { startLibraryImportAtom } from "../library/atoms"
import { settingsOpenAtom } from "./atoms"
import { AuthRequired, PanelCard } from "./settings-shared"

export function IntegrationsPanel({ user }: { user: AppUser | null }) {
  const setSettingsOpen = useAtomSet(settingsOpenAtom)
  const accountsResult = useAtomValue(accountHealthAtom)
  const refreshAccounts = useAtomRefresh(accountHealthAtom)

  const accounts = Result.builder(accountsResult)
    .onSuccess((value) => value)
    .orElse(() => [])

  const disconnectExternalAccount = useAtomSet(disconnectExternalAccountAtom, {
    mode: "promise",
  })

  const startLibraryImport = useAtomSet(startLibraryImportAtom, {
    mode: "promise",
  })

  const [pending, setPending] = useState<string | null>(null)

  if (!user) return <AuthRequired />

  const accountsError = Result.builder(accountsResult)
    .onFailure(() => <DataError onRetry={refreshAccounts} />)
    .orNull()

  if (accountsError) return accountsError

  const connectHref = (provider: "mal" | "anilist") => {
    const callbackURL = new URL(window.location.href)

    callbackURL.searchParams.set("oauth_result", "connected")
    callbackURL.searchParams.set("oauth_provider", provider)

    return `${apiUrl}/api/link/${provider}?callbackURL=${encodeURIComponent(callbackURL.toString())}`
  }

  const disconnect = async (provider: "mal" | "anilist") => {
    setPending(provider)

    try {
      await disconnectExternalAccount({
        payload: { provider },
        reactivityKeys: ["integrations"],
      })
      toast.success("Integration disconnected.")
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to disconnect"))
    } finally {
      setPending(null)
    }
  }

  const runImport = async (provider: "mal" | "anilist") => {
    setPending(`${provider}:import`)

    try {
      const job = await startLibraryImport({ payload: { provider } })
      toast.success(`Import queued: ${job.id}`)
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to start import"))
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button asChild variant="outline" className="self-start">
        <Link
          to="/sync-activity"
          search={{ page: 1 }}
          onClick={() => setSettingsOpen(false)}
        >
          View sync activity
        </Link>
      </Button>
      {accounts.map((account) => (
        <PanelCard key={account.provider}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">
                  {account.provider === "mal" ? "MyAnimeList" : "AniList"}
                </h3>
                <Badge variant={account.connected ? "default" : "secondary"}>
                  {account.state === "expiring"
                    ? "Expiring soon"
                    : account.state === "relink_required" ||
                        account.state === "expired"
                      ? "Reconnect required"
                      : account.connected
                        ? "Connected"
                        : "Disconnected"}
                </Badge>
              </div>
              {account.expiresAt ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Token expires {new Date(account.expiresAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            {account.connected ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={pending === `${account.provider}:import`}
                  onClick={() => void runImport(account.provider)}
                >
                  <Download data-icon="inline-start" />
                  Import
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending === account.provider}
                  onClick={() => void disconnect(account.provider)}
                >
                  <Unlink data-icon="inline-start" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button asChild>
                <a href={connectHref(account.provider)}>
                  <Link2 data-icon="inline-start" />
                  Connect
                </a>
              </Button>
            )}
          </div>
        </PanelCard>
      ))}
    </div>
  )
}
