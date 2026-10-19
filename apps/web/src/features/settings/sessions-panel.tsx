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
import { useAtom, useAtomValue } from "@effect/atom-react"
import * as Effect from "effect/Effect"
import type * as Exit from "effect/Exit"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { LogOut, MonitorOff } from "lucide-react"
import { toast } from "sonner"
import { auth } from "../../services/auth"
import { toastFailure } from "../../utils/error"
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

// The list is `null` when it couldn't be loaded; the section stays usable.
const sessionsAtom = Atom.make(
  auth((client) => client.listSessions()).pipe(
    Effect.map((sessions): ReadonlyArray<Session> => sessions ?? []),
    Effect.orElseSucceed(() => null)
  )
)

const revokeSessionAtom = Atom.family((token: string) =>
  Atom.fn<void>()((_, get) =>
    auth((client) => client.revokeSession({ token })).pipe(
      Effect.tap(() => Effect.sync(() => get.refresh(sessionsAtom)))
    )
  )
)

const revokeOtherSessionsAtom = Atom.fn<void>()((_, get) =>
  auth((client) => client.revokeOtherSessions()).pipe(
    Effect.tap(() => Effect.sync(() => get.refresh(sessionsAtom)))
  )
)

const signedOut =
  (success: string, failure: string) => (exit: Exit.Exit<unknown, unknown>) => {
    if (toastFailure(failure)(exit)) toast.success(success)
  }

export function SessionsSection({
  currentSessionToken,
}: {
  currentSessionToken: string | null
}) {
  const loaded = AsyncResult.getOrElse(useAtomValue(sessionsAtom), () => null)
  const sessions = [...(loaded ?? [])].sort(
    (a, b) =>
      Number(b.token === currentSessionToken) -
        Number(a.token === currentSessionToken) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  const [revokeOthersResult, revokeOthers] = useAtom(revokeOtherSessionsAtom, {
    mode: "promiseExit",
  })

  const action = (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={sessions.length <= 1 || revokeOthersResult.waiting}
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
            onClick={() =>
              void revokeOthers().then(
                signedOut(
                  "Other sessions revoked.",
                  "Unable to revoke sessions"
                )
              )
            }
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
          {sessions.map((item) => (
            <SessionRow
              key={item.id}
              session={item}
              isCurrent={item.token === currentSessionToken}
            />
          ))}
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

function SessionRow({
  session,
  isCurrent,
}: {
  session: Session
  isCurrent: boolean
}) {
  const [result, revoke] = useAtom(revokeSessionAtom(session.token), {
    mode: "promiseExit",
  })
  const device = describeUserAgent(session.userAgent)
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <device.icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{device.label}</p>
          {isCurrent ? <Badge variant="secondary">This device</Badge> : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {session.ipAddress || "Unknown IP"} · Signed in{" "}
          {relative(session.createdAt)}
        </p>
      </div>
      {isCurrent ? null : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              disabled={result.waiting}
              onClick={() =>
                void revoke().then(
                  signedOut("Session revoked.", "Unable to revoke session")
                )
              }
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
}
