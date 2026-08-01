import { Button } from "@animekaiser/ui/components/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@animekaiser/ui/components/field"
import { Input } from "@animekaiser/ui/components/input"
import { Spinner } from "@animekaiser/ui/components/spinner"
import { useAtomSet } from "@effect-atom/atom-react"
import { useForm } from "@tanstack/react-form"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { authClient, navigateAfterAuthChange } from "../../services/api-clients"
import { errorMessage } from "../../utils/error"
import type { AppUser } from "../auth/user"
import { displayUsername } from "../auth/user"
import { deleteAccountAtom } from "../profile/atoms"
import { AuthRequired, PanelCard } from "./settings-shared"

type ChangePasswordValues = {
  currentPassword: string
  newPassword: string
  confirmation: string
}

type DeleteAccountValues = {
  deletePassword: string
}

export function AccountPanel({
  user,
  sessionExpiresAt,
}: {
  user: AppUser | null
  sessionExpiresAt: Date | null
}) {
  const deleteKaiserAccount = useAtomSet(deleteAccountAtom, {
    mode: "promise",
  })

  const [confirmationError, setConfirmationError] = useState<string | null>(
    null
  )

  const passwordForm = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmation: "",
    },
    onSubmit: ({ value }) => changePassword(value),
  })
  const deleteForm = useForm({
    defaultValues: { deletePassword: "" },
    onSubmit: ({ value }) => deleteAccount(value),
  })

  if (!user) return <AuthRequired />

  const changePassword = async (values: ChangePasswordValues) => {
    if (values.newPassword !== values.confirmation) {
      setConfirmationError("Passwords do not match.")
      return
    }
    try {
      const result = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: false,
      })
      if (result.error) throw result.error
      passwordForm.reset()
      setConfirmationError(null)
      toast.success("Password updated.")
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to change password"))
    }
  }

  const deleteAccount = async (values: DeleteAccountValues) => {
    if (
      !window.confirm(
        "Delete your AnimeKaiser account permanently? This cannot be undone."
      )
    )
      return
    try {
      await deleteKaiserAccount({
        payload: { password: values.deletePassword },
      })

      await authClient.signOut()
      navigateAfterAuthChange("/")
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to delete account"))
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
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void passwordForm.handleSubmit()
          }}
        >
          <div>
            <h3 className="font-semibold">Change password</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Use at least eight characters.
            </p>
          </div>
          <FieldGroup className="grid gap-4 lg:grid-cols-3">
            <passwordForm.Field name="currentPassword">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Current password</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="current-password"
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Field>
              )}
            </passwordForm.Field>
            <passwordForm.Field name="newPassword">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>New password</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Field>
              )}
            </passwordForm.Field>
            <passwordForm.Field name="confirmation">
              {(field) => (
                <Field data-invalid={Boolean(confirmationError)}>
                  <FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
                  <Input
                    aria-invalid={Boolean(confirmationError)}
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      setConfirmationError(null)
                      field.handleChange(event.target.value)
                    }}
                  />
                  {confirmationError ? (
                    <FieldError>{confirmationError}</FieldError>
                  ) : null}
                </Field>
              )}
            </passwordForm.Field>
          </FieldGroup>
          <passwordForm.Subscribe selector={(state) => state.isSubmitting}>
            {(pending) => (
              <Button className="w-fit" disabled={pending} type="submit">
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Update password
              </Button>
            )}
          </passwordForm.Subscribe>
        </form>
      </PanelCard>
      <PanelCard className="border-destructive/30">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void deleteForm.handleSubmit()
          }}
        >
          <div>
            <h3 className="font-semibold text-destructive">Delete account</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently remove your account and profile.
            </p>
          </div>
          <deleteForm.Field name="deletePassword">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  Confirm with your password
                </FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  className="max-w-sm"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </deleteForm.Field>
          <deleteForm.Subscribe selector={(state) => state.isSubmitting}>
            {(pending) => (
              <Button
                className="w-fit"
                variant="destructive"
                disabled={pending}
                type="submit"
              >
                {pending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Trash2 data-icon="inline-start" />
                )}
                Delete account
              </Button>
            )}
          </deleteForm.Subscribe>
        </form>
      </PanelCard>
    </div>
  )
}
