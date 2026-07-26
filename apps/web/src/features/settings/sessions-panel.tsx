import { Button } from "@workspace/ui/components/button"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { authClient, reconnectKaiserRpc } from "../../services/api-clients"
import { errorMessage } from "../../utils/error"
import type { AppUser } from "../auth/user"
import { AuthRequired } from "./settings-shared"

export function SessionsPanel({ user }: { user: AppUser | null }) {
  const [sessions, setSessions] = useState<
    Array<{
      id: string
      token: string
      userAgent?: string | null
      ipAddress?: string | null
      createdAt: Date | string
      expiresAt: Date | string
    }>
  >([])
  const [pending, setPending] = useState<string | null>(null)

  const refresh = async () => {
    const result = await authClient.listSessions()

    if (result.error) throw result.error

    setSessions(result.data)
  }

  useEffect(() => {
    if (user) void refresh().catch(() => setSessions([]))
  }, [user])

  if (!user) return <AuthRequired />

  const revoke = async (token: string) => {
    setPending(token)

    try {
      const result = await authClient.revokeSession({ token })
      if (result.error) throw result.error

      await reconnectKaiserRpc()
      await refresh()
      toast.success("Session revoked.")
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to revoke session"))
    } finally {
      setPending(null)
    }
  }

  const revokeOthers = async () => {
    setPending("others")

    try {
      const result = await authClient.revokeOtherSessions()
      if (result.error) throw result.error
      await refresh()
      toast.success("Other sessions revoked.")
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to revoke sessions"))
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          disabled={pending === "others"}
          onClick={() => void revokeOthers()}
        >
          Revoke other sessions
        </Button>
      </div>
      <div className="divide-y rounded-2xl border bg-background/60">
        {sessions.length ? (
          sessions.map((item) => (
            <div
              className="flex flex-wrap items-start justify-between gap-4 p-4"
              key={item.id}
            >
              <div>
                <p className="font-medium">
                  {item.userAgent || "Unknown device"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.ipAddress || "Unknown IP"} · started{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={pending === item.token}
                onClick={() => void revoke(item.token)}
              >
                Revoke
              </Button>
            </div>
          ))
        ) : (
          <p className="p-5 text-sm text-muted-foreground">
            No active sessions found.
          </p>
        )}
      </div>
    </div>
  )
}
