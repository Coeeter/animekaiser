import { Link } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Download, Link2, Unlink } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { apiUrl } from "../../lib/api-url"
import type { AppUser } from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import {
  disconnectExternalAccount,
  loadExternalAccounts,
} from "../integrations/integration-rpc"
import { startLibraryImport } from "../library/import-rpc"
import { AuthRequired, PanelCard } from "./settings-shared"

export function IntegrationsPanel({
  user,
  onClose,
}: {
  user: AppUser | null
  onClose: () => void
}) {
  const [accounts, setAccounts] = useState<
    Awaited<ReturnType<typeof loadExternalAccounts>>
  >([])
  const [pending, setPending] = useState<string | null>(null)
  const refresh = async () => setAccounts(await loadExternalAccounts())
  useEffect(() => {
    if (user) void refresh().catch(() => setAccounts([]))
  }, [user])
  if (!user) return <AuthRequired />
  const connect = (provider: "mal" | "anilist") => {
    const callbackURL = new URL(window.location.href)
    callbackURL.searchParams.set("oauth_result", "connected")
    callbackURL.searchParams.set("oauth_provider", provider)
    window.location.href = `${apiUrl}/api/link/${provider}?callbackURL=${encodeURIComponent(callbackURL.toString())}`
  }
  const disconnect = async (provider: "mal" | "anilist") => {
    setPending(provider)
    try {
      await disconnectExternalAccount(provider)
      await refresh()
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
      const job = await startLibraryImport(provider)
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
        <Link to="/sync-activity" search={{ page: 1 }} onClick={onClose}>
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
              <Button onClick={() => connect(account.provider)}>
                <Link2 data-icon="inline-start" />
                Connect
              </Button>
            )}
          </div>
        </PanelCard>
      ))}
    </div>
  )
}
