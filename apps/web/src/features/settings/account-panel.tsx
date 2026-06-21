import { useNavigate, useRouter } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { Trash2 } from "lucide-react"
import type { FormEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"
import type { AppUser } from "../../lib/auth-client"
import { authClient, displayUsername } from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import { deleteAccount as deleteKaiserAccount } from "../profile/profile-rpc"
import { AuthRequired, PanelCard } from "./settings-shared"

export function AccountPanel({
  user,
  sessionExpiresAt,
}: {
  user: AppUser | null
  sessionExpiresAt: Date | null
}) {
  const router = useRouter()
  const navigate = useNavigate()
  const [passwordPending, setPasswordPending] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  if (!user) return <AuthRequired />

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const currentPassword = String(form.get("currentPassword") ?? "")
    const newPassword = String(form.get("newPassword") ?? "")
    const confirmation = String(form.get("confirmation") ?? "")
    if (newPassword !== confirmation)
      return toast.error("Passwords do not match.")
    setPasswordPending(true)
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      })
      if (result.error) throw result.error
      event.currentTarget.reset()
      toast.success("Password updated.")
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to change password"))
    } finally {
      setPasswordPending(false)
    }
  }

  const deleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !window.confirm(
        "Delete your AnimeKaiser account permanently? This cannot be undone."
      )
    )
      return
    const password = String(
      new FormData(event.currentTarget).get("deletePassword") ?? ""
    )
    setDeletePending(true)
    try {
      await deleteKaiserAccount(password)
      await authClient.signOut()
      await router.invalidate()
      await navigate({ to: "/" })
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to delete account"))
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelCard>
          <h3 className="font-semibold">Identity</h3>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Username</dt>
              <dd className="mt-1 font-medium">@{displayUsername(user)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-1 font-medium">{user.email}</dd>
            </div>
          </dl>
        </PanelCard>
        <PanelCard>
          <h3 className="font-semibold">Access</h3>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Last login method</dt>
              <dd className="mt-1 font-medium">
                {authClient.getLastUsedLoginMethod() ?? "Unknown"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Session expires</dt>
              <dd className="mt-1 font-medium">
                {sessionExpiresAt
                  ? sessionExpiresAt.toLocaleString()
                  : "Unknown"}
              </dd>
            </div>
          </dl>
        </PanelCard>
      </div>
      <PanelCard>
        <form className="flex flex-col gap-4" onSubmit={changePassword}>
          <div>
            <h3 className="font-semibold">Change password</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Use at least eight characters.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="current-password">
                Current password
              </FieldLabel>
              <Input
                id="current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">
                Confirm password
              </FieldLabel>
              <Input
                id="confirm-password"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
          </div>
          <Button className="w-fit" disabled={passwordPending} type="submit">
            {passwordPending ? <Spinner data-icon="inline-start" /> : null}
            Update password
          </Button>
        </form>
      </PanelCard>
      <PanelCard className="border-destructive/30">
        <form className="flex flex-col gap-4" onSubmit={deleteAccount}>
          <div>
            <h3 className="font-semibold text-destructive">Delete account</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently remove your account and profile.
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="delete-password">
              Confirm with your password
            </FieldLabel>
            <Input
              className="max-w-sm"
              id="delete-password"
              name="deletePassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Button
            className="w-fit"
            variant="destructive"
            disabled={deletePending}
            type="submit"
          >
            {deletePending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Trash2 data-icon="inline-start" />
            )}
            Delete account
          </Button>
        </form>
      </PanelCard>
    </div>
  )
}
