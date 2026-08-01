import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@animekaiser/ui/components/alert-dialog"
import { Badge } from "@animekaiser/ui/components/badge"
import { Button } from "@animekaiser/ui/components/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@animekaiser/ui/components/empty"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@animekaiser/ui/components/tooltip"
import { LogOut, MonitorOff } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { authClient } from "../../services/api-clients"
import { errorMessage } from "../../utils/error"
import { SettingHeading } from "./settings-shared"
import { describeUserAgent } from "./user-agent"

type Session = {
  id: string
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt: Date | string
  expiresAt: Date | string
}

const relative = (value: Date | string) => {
  const date = new Date(value)
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000)
  if (Math.abs(days) > 30) return date.toLocaleDateString()
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  if (Math.abs(days) >= 1) return formatter.format(days, "day")
  const hours = Math.round((date.getTime() - Date.now()) / 3_600_000)
  if (Math.abs(hours) >= 1) return formatter.format(hours, "hour")
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000)
  return formatter.format(minutes, "minute")
}

export function SessionsSection({
  currentSessionToken,
}: {
  currentSessionToken: string | null
}) {
  const [sessions, setSessions] = useState<Array<Session>>([])
  const [pending, setPending] = useState<string | null>(null)
  const refresh = async () => {
    const result = await authClient.listSessions()
    if (result.error) throw result.error
    setSessions(
      [...result.data].sort(
        (a, b) =>
          Number(b.token === currentSessionToken) -
            Number(a.token === currentSessionToken) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    )
  }
  useEffect(() => {
    void refresh().catch(() => setSessions([]))
  }, [currentSessionToken])

  const revoke = async (token: string) => {
    setPending(token)
    try {
      const result = await authClient.revokeSession({ token })
      if (result.error) throw result.error
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

  const action = (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={sessions.length <= 1 || pending === "others"}
        >
          Sign out everywhere else
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out everywhere else?</AlertDialogTitle>
          <AlertDialogDescription>
            Other devices will need to sign in again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => void revokeOthers()}
          >
            Sign out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return (
    <div className="flex flex-col gap-4">
      <SettingHeading
        title="Active sessions"
        description="Devices currently signed in to your account."
        action={action}
      />
      {sessions.length ? (
        <div className="flex flex-col gap-2">
          {sessions.map((item) => {
            const device = describeUserAgent(item.userAgent)
            const isCurrent = item.token === currentSessionToken
            return (
              <div
                className="flex items-center gap-3 rounded-xl border bg-card/40 p-3"
                key={item.id}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <device.icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{device.label}</p>
                    {isCurrent ? (
                      <Badge variant="secondary">This device</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {item.ipAddress || "Unknown IP"} · Signed in{" "}
                    {relative(item.createdAt)}
                  </p>
                </div>
                {isCurrent ? null : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={pending === item.token}
                        onClick={() => void revoke(item.token)}
                      >
                        <LogOut />
                        <span className="sr-only">Revoke session</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Revoke session</TooltipContent>
                  </Tooltip>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MonitorOff />
            </EmptyMedia>
            <EmptyTitle>No active sessions found</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}
